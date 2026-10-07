package com.example.kanban;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.stream.IntStream;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

// 同じリストへ同時にカードを追加しても、position が重ならない（リストの行のロック）ことを確かめる。
// 本物の同時実行にするため、トランザクションを巻き戻すテスト（@Transactional）にはせず、最後にリストを消す
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class CardPositionConcurrencyTests {

	private static final int THREADS = 8;

	@Autowired
	BoardService boardService;

	@Autowired
	CardRepository cardRepository;

	private Long listId;

	@AfterEach
	void deleteList() {
		if (listId != null) {
			boardService.deleteList(listId);
		}
	}

	@Test
	void 同時に追加しても_position_は_0_から順に重ならない() throws Exception {
		listId = boardService.createList("同時追加").id();
		CountDownLatch start = new CountDownLatch(1);
		ExecutorService executor = Executors.newFixedThreadPool(THREADS);
		try {
			List<Future<CardResponse>> results = IntStream.range(0, THREADS).mapToObj(i -> executor.submit(() -> {
				start.await();
				return boardService.createCard(listId, "カード" + i, null, null);
			})).toList();
			start.countDown();
			for (Future<CardResponse> result : results) {
				result.get();
			}
		}
		finally {
			executor.shutdown();
		}

		List<Integer> positions = cardRepository.findByListIdOrderByPositionAsc(listId)
			.stream()
			.map(Card::getPosition)
			.toList();
		assertThat(positions).containsExactlyElementsOf(IntStream.range(0, THREADS).boxed().toList());
	}

}
