package com.example.kanban;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.transaction.annotation.Transactional;

import com.jayway.jsonpath.JsonPath;

import jakarta.persistence.EntityManager;

// API を通して DB（開発用 PostgreSQL）を読み書きするテスト。
// テストごとにトランザクションを巻き戻すので、DB の中身は変わらない
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class BoardApiTests {

	@Autowired
	MockMvcTester mvc;

	@Autowired
	EntityManager entityManager;

	@Test
	void リストを追加して名前を変えて削除できる() {
		long id = createList("買い物");
		assertThat(boardJson()).contains("\"title\":\"買い物\"");

		assertThat(send(mvc.patch().uri("/api/lists/{id}", id), "{\"title\":\"買い物リスト\"}"))
			.hasStatusOk()
			.bodyJson().extractingPath("$.title").isEqualTo("買い物リスト");

		assertThat(mvc.delete().uri("/api/lists/{id}", id)).hasStatus(HttpStatus.NO_CONTENT);
		assertThat(boardJson()).doesNotContain("買い物リスト");
	}

	@Test
	void 空のタイトルは追加できない() {
		assertThat(send(mvc.post().uri("/api/lists"), "{\"title\":\"  \"}")).hasStatus(HttpStatus.BAD_REQUEST);

		long listId = createList("テスト");
		assertThat(send(mvc.post().uri("/api/lists/{id}/cards", listId), "{\"title\":\"\"}"))
			.hasStatus(HttpStatus.BAD_REQUEST);

		long cardId = createCard(listId, "カード");
		assertThat(send(mvc.patch().uri("/api/cards/{id}", cardId), "{\"title\":\" \"}"))
			.hasStatus(HttpStatus.BAD_REQUEST);
	}

	@Test
	void カードを追加して編集して削除できる() {
		long listId = createList("テスト");
		MvcTestResult created = send(mvc.post().uri("/api/lists/{id}/cards", listId),
				"{\"title\":\"レポート\",\"priority\":\"high\",\"due\":\"2026-10-10\"}");
		assertThat(created).hasStatus(HttpStatus.CREATED);
		long cardId = idOf(created);

		// 送った項目だけ変わる
		assertThat(send(mvc.patch().uri("/api/cards/{id}", cardId), "{\"title\":\"レポートを書く\"}"))
			.bodyJson().isLenientlyEqualTo(
					"{\"title\":\"レポートを書く\",\"priority\":\"high\",\"due\":\"2026-10-10\"}");

		// due に null を送ると期限が消える
		assertThat(send(mvc.patch().uri("/api/cards/{id}", cardId), "{\"due\":null,\"priority\":\"low\"}"))
			.bodyJson().isLenientlyEqualTo("{\"title\":\"レポートを書く\",\"priority\":\"low\",\"due\":null}");

		assertThat(send(mvc.patch().uri("/api/cards/{id}", cardId), "{\"priority\":\"top\"}"))
			.hasStatus(HttpStatus.BAD_REQUEST);

		assertThat(mvc.delete().uri("/api/cards/{id}", cardId)).hasStatus(HttpStatus.NO_CONTENT);
		assertThat(mvc.delete().uri("/api/cards/{id}", cardId)).hasStatus(HttpStatus.NOT_FOUND);
	}

	@Test
	void カードを別のリストや同じリストの別の位置へ移動できる() {
		long from = createList("移動元");
		long to = createList("移動先");
		long a = createCard(from, "A");
		long b = createCard(from, "B");
		long c = createCard(from, "C");
		long x = createCard(to, "X");

		// B を移動先の先頭へ
		move(b, to, 0);
		assertThat(cardIds(from)).containsExactly(a, c);
		assertThat(cardIds(to)).containsExactly(b, x);

		// 同じリストの中で A を末尾へ（大きすぎる position は末尾扱い）
		move(a, from, 99);
		assertThat(cardIds(from)).containsExactly(c, a);

		// 存在しないリストへは移動できない
		assertThat(send(mvc.put().uri("/api/cards/{id}/move", c), "{\"listId\":999999,\"position\":0}"))
			.hasStatus(HttpStatus.NOT_FOUND);
	}

	@Test
	void リストを消すと中のカードも消える() {
		long listId = createList("テスト");
		long cardId = createCard(listId, "消えるカード");

		assertThat(mvc.delete().uri("/api/lists/{id}", listId)).hasStatus(HttpStatus.NO_CONTENT);

		// カードは DB 側で消えるので、JPA が覚えている古いカードを捨ててから確かめる
		// （実際の API はリクエストごとに別のトランザクションなので、この処理はいらない）
		entityManager.flush();
		entityManager.clear();
		assertThat(send(mvc.patch().uri("/api/cards/{id}", cardId), "{\"title\":\"x\"}"))
			.hasStatus(HttpStatus.NOT_FOUND);
	}

	private MvcTestResult send(MockMvcTester.MockMvcRequestBuilder request, String json) {
		return request.contentType(MediaType.APPLICATION_JSON).content(json).exchange();
	}

	private long createList(String title) {
		MvcTestResult result = send(mvc.post().uri("/api/lists"), "{\"title\":\"" + title + "\"}");
		assertThat(result).hasStatus(HttpStatus.CREATED);
		return idOf(result);
	}

	private long createCard(long listId, String title) {
		MvcTestResult result = send(mvc.post().uri("/api/lists/{id}/cards", listId), "{\"title\":\"" + title + "\"}");
		assertThat(result).hasStatus(HttpStatus.CREATED);
		return idOf(result);
	}

	private void move(long cardId, long listId, int position) {
		assertThat(send(mvc.put().uri("/api/cards/{id}/move", cardId),
				"{\"listId\":" + listId + ",\"position\":" + position + "}"))
			.hasStatus(HttpStatus.NO_CONTENT);
	}

	private String boardJson() {
		MvcTestResult result = mvc.get().uri("/api/board").exchange();
		assertThat(result).hasStatusOk();
		return body(result);
	}

	// GET /api/board の中で、指定したリストのカードの id を上から順に返す
	private List<Long> cardIds(long listId) {
		List<Number> ids = JsonPath.read(boardJson(), "$.lists[?(@.id == " + listId + ")].cards[*].id");
		return ids.stream().map(Number::longValue).toList();
	}

	private long idOf(MvcTestResult result) {
		return ((Number) JsonPath.read(body(result), "$.id")).longValue();
	}

	private String body(MvcTestResult result) {
		try {
			return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
		}
		catch (UnsupportedEncodingException e) {
			throw new IllegalStateException(e);
		}
	}

}
