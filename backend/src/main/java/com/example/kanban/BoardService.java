package com.example.kanban;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.criteria.Predicate;

// リストとカードの読み書き。1 回の API 呼び出しが 1 つのトランザクションになる
@Service
@Transactional
public class BoardService {

	private final TaskListRepository listRepository;

	private final CardRepository cardRepository;

	public BoardService(TaskListRepository listRepository, CardRepository cardRepository) {
		this.listRepository = listRepository;
		this.cardRepository = cardRepository;
	}

	@Transactional(readOnly = true)
	public List<ListResponse> getBoard() {
		// カードを position 順のまま list_id ごとに分ける
		Map<Long, List<CardResponse>> cardsByList = cardRepository.findAllByOrderByPositionAsc()
			.stream()
			.collect(Collectors.groupingBy(Card::getListId,
					Collectors.mapping(CardResponse::from, Collectors.toList())));

		return listRepository.findAllByOrderByPositionAsc()
			.stream()
			.map(l -> ListResponse.from(l, cardsByList.getOrDefault(l.getId(), List.of())))
			.toList();
	}

	// ---- カードの検索・取得 ----

	// 指定した条件をすべて満たすカードを返す（null・空の条件は使わない）。
	// 並び順は画面と同じで、リストの position 順 → リストの中の position 順
	@Transactional(readOnly = true)
	public List<CardDetailResponse> searchCards(String keyword, Long listId, Priority priority, LocalDate dueFrom,
			LocalDate dueTo) {
		if (listId != null) {
			findList(listId);
		}
		// カードと一緒にリストも読んでいる（CardRepository.findAll の @EntityGraph）
		return cardRepository.findAll(cardMatches(keyword, listId, priority, dueFrom, dueTo))
			.stream()
			.sorted(Comparator.comparingInt((Card c) -> c.getList().getPosition()).thenComparingInt(Card::getPosition))
			.map(CardDetailResponse::from)
			.toList();
	}

	@Transactional(readOnly = true)
	public CardDetailResponse getCard(Long id) {
		return CardDetailResponse.from(findCard(id));
	}

	// 検索条件を SQL の WHERE にする。期限で絞り込むときは、期限のないカードは含めない
	private static Specification<Card> cardMatches(String keyword, Long listId, Priority priority, LocalDate dueFrom,
			LocalDate dueTo) {
		return (root, query, cb) -> {
			List<Predicate> conditions = new ArrayList<>();
			if (keyword != null && !keyword.isBlank()) {
				// タイトルの部分一致。大文字・小文字は区別しない
				String pattern = "%" + escapeLike(keyword.strip().toLowerCase(Locale.ROOT)) + "%";
				conditions.add(cb.like(cb.lower(root.<String>get("title")), pattern, '\\'));
			}
			if (listId != null) {
				conditions.add(cb.equal(root.get("list").get("id"), listId));
			}
			if (priority != null) {
				conditions.add(cb.equal(root.get("priority"), priority));
			}
			if (dueFrom != null) {
				conditions.add(cb.greaterThanOrEqualTo(root.<LocalDate>get("due"), dueFrom));
			}
			if (dueTo != null) {
				conditions.add(cb.lessThanOrEqualTo(root.<LocalDate>get("due"), dueTo));
			}
			return cb.and(conditions.toArray(Predicate[]::new));
		};
	}

	// LIKE で特別な意味を持つ % と _ を、ただの文字として探せるようにする
	private static String escapeLike(String text) {
		return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
	}

	// ---- リスト（F-01） ----

	public ListResponse createList(String title) {
		TaskList list = listRepository.save(new TaskList(title, listRepository.findMaxPosition() + 1));
		return ListResponse.from(list, List.of());
	}

	public ListResponse renameList(Long id, String title) {
		TaskList list = findList(id);
		list.setTitle(title);
		List<CardResponse> cards = cardRepository.findByListIdOrderByPositionAsc(id)
			.stream()
			.map(CardResponse::from)
			.toList();
		return ListResponse.from(list, cards);
	}

	// 中のカードを消してからリストを消す。DB にも ON DELETE CASCADE があるが、
	// JPA が覚えているカードが消したリストを指したままにならないよう、JPA でも消す
	public void deleteList(Long id) {
		TaskList list = findList(id);
		cardRepository.deleteAll(cardRepository.findByListIdOrderByPositionAsc(id));
		listRepository.delete(list);
	}

	// ---- カード（F-02, F-03, F-08） ----

	// 新しいカードはリストの末尾に入る。リストをロックして、同時に追加しても position が重ならないようにする
	public CardResponse createCard(Long listId, String title, Priority priority, LocalDate due) {
		TaskList list = lockList(listId);
		Card card = new Card(list, title, cardRepository.findMaxPosition(listId) + 1);
		if (priority != null) {
			card.setPriority(priority);
		}
		card.setDue(due);
		return CardResponse.from(cardRepository.save(card));
	}

	// null の項目は変更しない。due だけは「期限を消す（null にする）」があるので dueSet で区別する
	public CardResponse updateCard(Long id, String title, Priority priority, boolean dueSet, LocalDate due) {
		Card card = findCard(id);
		if (title != null) {
			card.setTitle(title);
		}
		if (priority != null) {
			card.setPriority(priority);
		}
		if (dueSet) {
			card.setDue(due);
		}
		return CardResponse.from(card);
	}

	public void deleteCard(Long id) {
		cardRepository.delete(findCard(id));
	}

	// カードを移動先リストの position 番目（0 始まり）に入れ、移動元・移動先の position を 0, 1, 2… に振り直す。
	// position が移動先のカードの枚数以上なら末尾に入れる。
	// 移動元・移動先のリストをロックしてから並べ直す（id の小さい順にロックして、デッドロックを避ける）
	public void moveCard(Long id, Long toListId, int position) {
		Card card = findCard(id);
		Long fromListId = card.getListId();
		TaskList toList = lockLists(fromListId, toListId);

		List<Card> destination = new ArrayList<>(cardRepository.findByListIdOrderByPositionAsc(toListId));
		destination.removeIf(c -> c.getId().equals(id));
		destination.add(Math.min(position, destination.size()), card);
		card.setList(toList);
		renumber(destination);

		if (!fromListId.equals(toListId)) {
			renumber(cardRepository.findByListIdOrderByPositionAsc(fromListId)
				.stream()
				.filter(c -> !c.getId().equals(id))
				.toList());
		}
	}

	// 各リストのカードを、期限が近い順に並べて position を振り直す（F-09）。
	// 期限なしは最後、同じ期限なら優先順位の高い順、それも同じなら今の順のまま
	public void sortCardsByDue() {
		Comparator<Card> byDue = Comparator.comparing(Card::getDue, Comparator.nullsLast(Comparator.naturalOrder()))
			.thenComparing(Card::getPriority)
			.thenComparingInt(Card::getPosition);
		cardRepository.findAllByOrderByPositionAsc()
			.stream()
			.collect(Collectors.groupingBy(Card::getListId))
			.values()
			.forEach(cards -> renumber(cards.stream().sorted(byDue).toList()));
	}

	private void renumber(List<Card> cards) {
		for (int i = 0; i < cards.size(); i++) {
			cards.get(i).setPosition(i);
		}
	}

	private TaskList findList(Long id) {
		return listRepository.findById(id).orElseThrow(() -> listNotFound(id));
	}

	private TaskList lockList(Long id) {
		return listRepository.findByIdForUpdate(id).orElseThrow(() -> listNotFound(id));
	}

	// 2 つのリストを id の小さい順にロックし、toId のリストを返す（同じリストなら 1 回だけ）
	private TaskList lockLists(Long fromId, Long toId) {
		if (fromId.equals(toId)) {
			return lockList(toId);
		}
		TaskList first = lockList(Math.min(fromId, toId));
		TaskList second = lockList(Math.max(fromId, toId));
		return first.getId().equals(toId) ? first : second;
	}

	private static NotFoundException listNotFound(Long id) {
		return new NotFoundException("リストが見つかりません（id: " + id + "）");
	}

	private Card findCard(Long id) {
		return cardRepository.findById(id).orElseThrow(() -> new NotFoundException("カードが見つかりません（id: " + id + "）"));
	}

}
