package com.example.kanban;

import javax.sql.DataSource;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

// デモ環境（公開環境）で、ボードを決まった時刻にサンプルの状態へ戻す。
// 設定 kanban.demo.reset-cron（例：0 0 4 * * *）があるときだけ動く。開発・テストでは設定しない
@Service
@ConditionalOnProperty("kanban.demo.reset-cron")
public class DemoResetService {

	private static final Logger log = LoggerFactory.getLogger(DemoResetService.class);

	private final DataSource dataSource;

	private final TransactionTemplate transactionTemplate;

	private final CardRepository cardRepository;

	public DemoResetService(DataSource dataSource, TransactionTemplate transactionTemplate,
			CardRepository cardRepository) {
		this.dataSource = dataSource;
		this.transactionTemplate = transactionTemplate;
		this.cardRepository = cardRepository;
	}

	// 起動したときにカードが 1 枚もなければサンプルを入れる（再起動のたびには消さない）
	@EventListener(ApplicationReadyEvent.class)
	public void fillIfEmpty() {
		if (this.cardRepository.count() == 0) {
			reset();
		}
	}

	// 全部消して、初期の 3 リスト + サンプルのカード（開発用のテストデータと同じ）に戻す。
	// 途中で失敗したら元のまま残るよう、1 つのトランザクションで実行する
	@Scheduled(cron = "${kanban.demo.reset-cron}", zone = "Asia/Tokyo")
	public void reset() {
		ResourceDatabasePopulator populator = new ResourceDatabasePopulator(new ClassPathResource("db/demo/reset.sql"),
				new ClassPathResource("db/testdata/V1_0_1__insert_test_data.sql"));
		populator.setSqlScriptEncoding("UTF-8");
		this.transactionTemplate.executeWithoutResult((status) -> populator.execute(this.dataSource));
		log.info("デモ用のサンプルデータに戻しました");
	}

}
