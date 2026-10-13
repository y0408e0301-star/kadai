package com.example.kanban;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

// デモ環境のリセット（DemoResetService）のテスト。設定 kanban.demo.reset-cron を入れたときだけ動く。
// テストごとにトランザクションを巻き戻すので、ほかのテストには影響しない
@SpringBootTest(properties = "kanban.demo.reset-cron=0 0 4 * * *")
@Import(TestcontainersConfiguration.class)
@Transactional
class DemoResetTests {

	@Autowired
	DemoResetService demoResetService;

	@Autowired
	JdbcTemplate jdbc;

	@Test
	void 起動したときにカードがなければサンプルが入る() {
		assertThat(count("lists")).isEqualTo(3);
		assertThat(count("cards")).isEqualTo(11);
	}

	@Test
	void リセットすると初期の3リストとサンプルのカードに戻りidも振り直される() {
		this.jdbc.update("INSERT INTO lists (title, position) VALUES ('荒らし', 3)");
		this.jdbc.update("DELETE FROM cards WHERE title = 'レポートを書く'");

		this.demoResetService.reset();

		assertThat(this.jdbc.queryForList("SELECT title FROM lists ORDER BY position", String.class))
			.containsExactly("やること", "作業中", "完了");
		assertThat(count("cards")).isEqualTo(11);
		assertThat(this.jdbc.queryForObject("SELECT min(id) FROM lists", Long.class)).isEqualTo(1L);
		assertThat(this.jdbc.queryForObject("SELECT count(*) FROM cards WHERE title = 'レポートを書く'", Integer.class))
			.isEqualTo(1);
	}

	private int count(String table) {
		return this.jdbc.queryForObject("SELECT count(*) FROM " + table, Integer.class);
	}

}
