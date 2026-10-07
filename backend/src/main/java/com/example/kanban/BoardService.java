package com.example.kanban;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

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
	public List<CardDetailResponse> searchCards(String keyword, Long listId, String priority, LocalDate dueFrom,
			LocalDate dueTo) {
		if (listId != null) {
			findList(listId);
		}
		Map<Long, TaskList> lists = listRepository.findAll()
			.stream()
			.collect(Collectors.toMap(TaskList::getId, Function.identity()));

		return cardRepository.findAll(cardMatches(keyword, listId, priority, dueFrom, dueTo))
			.stream()
			.sorted(Comparator.comparingInt((Card c) -> lists.get(c.getListId()).getPosition())
				.thenComparingInt(Card::getPosition))
			.map(c -> CardDetailResponse.from(c, lists.get(c.getListId())))
			.toList();
	}

	@Transactional(readOnly = true)
	public CardDetailResponse getCard(Long id) {
		Card card = findCard(id);
		return CardDetailResponse.from(card, findList(card.getListId()));
	}

	// 検索条件を SQL の WHERE にする。期限で絞り込むときは、期限のないカードは含めない
	private static Specification<Card> cardMatches(String keyword, Long listId, String priority, LocalDate dueFrom,
			LocalDate dueTo) {
		return (root, query, cb) -> {
			List<Predicate> conditions = new ArrayList<>();
			if (keyword != null && !keyword.isBlank()) {
				// タイトルの部分一致。大文字・小文字は区別しない
				String pattern = "%" + escapeLike(keyword.strip().toLowerCase(Locale.ROOT)) + "%";
				conditions.add(cb.like(cb.lower(root.<String>get("title")), pattern, '\\'));
			}
			if (listId != null) {
				conditions.add(cb.equal(root.get("listId"), listId));
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

	// 中のカードは DB の ON DELETE CASCADE で一緒に消える
	public void deleteList(Long id) {
		listRepository.delete(findList(id));
	}

	// ---- カード（F-02, F-03, F-08） ----

	// 新しいカードはリストの末尾に入る
	public CardResponse createCard(Long listId, String title, String priority, LocalDate due) {
		findList(listId);
		Card card = new Card(listId, title, cardRepository.findMaxPosition(listId) + 1);
		if (priority != null) {
			card.setPriority(priority);
		}
		card.setDue(due);
		return CardResponse.from(cardRepository.save(card));
	}

	// null の項目は変更しない。due だけは「期限を消す（null にする）」があるので dueSet で区別する
	public CardResponse updateCard(Long id, String title, String priority, boolean dueSet, LocalDate due) {
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
	// position が移動先のカードの枚数以上なら末尾に入れる
	public void moveCard(Long id, Long toListId, int position) {
		Card card = findCard(id);
		findList(toListId);
		Long fromListId = card.getListId();

		List<Card> destination = new ArrayList<>(cardRepository.findByListIdOrderByPositionAsc(toListId));
		destination.removeIf(c -> c.getId().equals(id));
		destination.add(Math.min(position, destination.size()), card);
		card.setListId(toListId);
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
			.thenComparingInt(c -> priorityRank(c.getPriority()))
			.thenComparingInt(Card::getPosition);
		cardRepository.findAllByOrderByPositionAsc()
			.stream()
			.collect(Collectors.groupingBy(Card::getListId))
			.values()
			.forEach(cards -> renumber(cards.stream().sorted(byDue).toList()));
	}

	private static int priorityRank(String priority) {
		return switch (priority) {
			case "high" -> 0;
			case "low" -> 2;
			default -> 1;
		};
	}

	private void renumber(List<Card> cards) {
		for (int i = 0; i < cards.size(); i++) {
			cards.get(i).setPosition(i);
		}
	}

	private TaskList findList(Long id) {
		return listRepository.findById(id)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "リストが見つかりません: " + id));
	}

	private Card findCard(Long id) {
		return cardRepository.findById(id)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "カードが見つかりません: " + id));
	}

}
