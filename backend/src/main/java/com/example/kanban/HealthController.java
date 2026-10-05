package com.example.kanban;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

// 雛形の動作確認用。サーバーが起動していれば {"status":"ok"} を返す
@RestController
public class HealthController {

	@GetMapping("/api/health")
	public Map<String, String> health() {
		return Map.of("status", "ok");
	}

}
