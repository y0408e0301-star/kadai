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

		assertThat(send(mvc.patch().uri("/api/lists/{id}", id), "{\"title\":\"買い物リスト\"}")).hasStatusOk()
			.bodyJson()
			.extractingPath("$.title")
			.isEqualTo("買い物リスト");

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
	void 追加したカードはリストの末尾に入り_省略した項目は既定値になる() {
		long listId = createList("テスト");
		long first = createCard(listId, "1 枚目");

		// タイトルの前後の空白は取り除く。priority を省略すると mid、due を省略すると期限なし
		MvcTestResult created = send(mvc.post().uri("/api/lists/{id}/cards", listId), "{\"title\":\"  2 枚目  \"}");
		assertThat(created).hasStatus(HttpStatus.CREATED);
		assertThat(created).bodyJson().isLenientlyEqualTo("{\"title\":\"2 枚目\",\"priority\":\"mid\",\"due\":null}");

		assertThat(cardIds(listId)).containsExactly(first, idOf(created));
	}

	@Test
	void カードの追加で入力がおかしいときやリストがないときはエラーになる() {
		long listId = createList("テスト");
		String title201 = "あ".repeat(201);
		assertThat(send(mvc.post().uri("/api/lists/{id}/cards", listId), "{\"title\":\"" + title201 + "\"}"))
			.hasStatus(HttpStatus.BAD_REQUEST);
		assertThat(send(mvc.post().uri("/api/lists/{id}/cards", listId), "{\"title\":\"a\",\"priority\":\"top\"}"))
			.hasStatus(HttpStatus.BAD_REQUEST);
		assertThat(send(mvc.post().uri("/api/lists/{id}/cards", listId), "{\"title\":\"a\",\"due\":\"2026/10/10\"}"))
			.hasStatus(HttpStatus.BAD_REQUEST);
		assertThat(send(mvc.post().uri("/api/lists/{id}/cards", 999999), "{\"title\":\"a\"}"))
			.hasStatus(HttpStatus.NOT_FOUND);
		assertThat(cardIds(listId)).isEmpty();
	}

	@Test
	void カードを追加して編集して削除できる() {
		long listId = createList("テスト");
		MvcTestResult created = send(mvc.post().uri("/api/lists/{id}/cards", listId),
				"{\"title\":\"レポート\",\"priority\":\"high\",\"due\":\"2026-10-10\"}");
		assertThat(created).hasStatus(HttpStatus.CREATED);
		long cardId = idOf(created);

		// 送った項目だけ変わる
		assertThat(send(mvc.patch().uri("/api/cards/{id}", cardId), "{\"title\":\"レポートを書く\"}")).bodyJson()
			.isLenientlyEqualTo("{\"title\":\"レポートを書く\",\"priority\":\"high\",\"due\":\"2026-10-10\"}");

		// due に null を送ると期限が消える
		assertThat(send(mvc.patch().uri("/api/cards/{id}", cardId), "{\"due\":null,\"priority\":\"low\"}")).bodyJson()
			.isLenientlyEqualTo("{\"title\":\"レポートを書く\",\"priority\":\"low\",\"due\":null}");

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
	void 期限順に並べると期限が近い順_期限なしは最後_同じ期限なら優先順位の高い順になる() {
		long listId = createList("並べ替え");
		long none = createCard(listId, "期限なし");
		long late = createCard(listId, "遅い", "mid", "2026-12-01");
		long earlyLow = createCard(listId, "早い・低", "low", "2026-10-10");
		long earlyHigh = createCard(listId, "早い・高", "high", "2026-10-10");
		long earlyMid = createCard(listId, "早い・中", "mid", "2026-10-10");

		MvcTestResult result = mvc.post().uri("/api/board/sort-by-due").exchange();
		assertThat(result).hasStatusOk();
		List<Number> returned = JsonPath.read(body(result), "$.lists[?(@.id == " + listId + ")].cards[*].id");

		List<Long> expected = List.of(earlyHigh, earlyMid, earlyLow, late, none);
		assertThat(returned.stream().map(Number::longValue).toList()).isEqualTo(expected);
		// 並べ替えた順が DB に保存されている
		assertThat(cardIds(listId)).isEqualTo(expected);
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

	@Test
	void カードをキーワードで検索できる() {
		long first = createList("検索1");
		long second = createList("検索2");
		long a = createCard(second, "ZZ検索 Report");
		long b = createCard(first, "zz検索 レポート");
		createCard(first, "ZZ検でない別のカード");
		long c = createCard(first, "ZZ検索 100%_達成");

		// 大文字・小文字は区別せず、画面と同じ順（リストの順 → リストの中の順）で返る
		assertThat(searchIds("q", "zz検索 re")).containsExactly(a);
		assertThat(searchIds("q", "zz検索")).containsExactly(b, c, a);

		// % や _ はただの文字として探す
		assertThat(searchIds("q", "%_")).containsExactly(c);

		// どのリストに入っているかも返る
		assertThat(mvc.get().uri("/api/cards").param("q", "ZZ検索 レポート").exchange()).bodyJson()
			.extractingPath("$.cards[0].listTitle")
			.isEqualTo("検索1");
	}

	@Test
	void カードをリスト_優先順位_期限で絞り込める() {
		long listId = createList("絞り込み");
		long high = createCard(listId, "高", "high", "2026-10-10");
		long mid = createCard(listId, "中", "mid", "2026-10-20");
		long low = createCard(listId, "低", "low", null);

		String id = String.valueOf(listId);
		assertThat(searchIds("listId", id)).containsExactly(high, mid, low);
		assertThat(searchIds("listId", id, "priority", "high")).containsExactly(high);

		// 期限は両端を含む。期限で絞り込むと期限なしのカードは出ない
		assertThat(searchIds("listId", id, "dueFrom", "2026-10-10", "dueTo", "2026-10-19")).containsExactly(high);
		assertThat(searchIds("listId", id, "dueFrom", "2026-10-11")).containsExactly(mid);
		assertThat(searchIds("listId", id, "dueTo", "2026-12-31")).containsExactly(high, mid);
	}

	@Test
	void 検索条件がおかしいときはエラーになる() {
		assertThat(mvc.get().uri("/api/cards?priority=top").exchange()).hasStatus(HttpStatus.BAD_REQUEST);
		assertThat(mvc.get().uri("/api/cards?dueFrom=10/10").exchange()).hasStatus(HttpStatus.BAD_REQUEST);
		assertThat(mvc.get().uri("/api/cards?listId=999999").exchange()).hasStatus(HttpStatus.NOT_FOUND);
	}

	@Test
	void カードを1枚取得できる() {
		long listId = createList("取得");
		long cardId = createCard(listId, "読むカード", "low", "2026-11-01");

		assertThat(mvc.get().uri("/api/cards/{id}", cardId).exchange()).hasStatusOk()
			.bodyJson()
			.isStrictlyEqualTo("{\"id\":" + cardId + ",\"listId\":" + listId
					+ ",\"listTitle\":\"取得\",\"title\":\"読むカード\",\"priority\":\"low\",\"due\":\"2026-11-01\"}");

		assertThat(mvc.get().uri("/api/cards/{id}", 999999).exchange()).hasStatus(HttpStatus.NOT_FOUND);
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

	private long createCard(long listId, String title, String priority, String due) {
		String json = "{\"title\":\"" + title + "\",\"priority\":\"" + priority + "\",\"due\":"
				+ (due == null ? "null" : "\"" + due + "\"") + "}";
		MvcTestResult result = send(mvc.post().uri("/api/lists/{id}/cards", listId), json);
		assertThat(result).hasStatus(HttpStatus.CREATED);
		return idOf(result);
	}

	// GET /api/cards で返ったカードの id を順に返す。引数は検索条件の名前と値を交互に並べる
	private List<Long> searchIds(String... nameValues) {
		MockMvcTester.MockMvcRequestBuilder request = mvc.get().uri("/api/cards");
		for (int i = 0; i < nameValues.length; i += 2) {
			request.param(nameValues[i], nameValues[i + 1]);
		}
		MvcTestResult result = request.exchange();
		assertThat(result).hasStatusOk();
		List<Number> ids = JsonPath.read(body(result), "$.cards[*].id");
		return ids.stream().map(Number::longValue).toList();
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
