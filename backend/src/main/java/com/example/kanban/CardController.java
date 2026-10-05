package com.example.kanban;

import java.time.LocalDate;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

// カードの追加・編集・削除・移動（F-02, F-03, F-08）
@RestController
public class CardController {

	// 追加：{"title": "レポートを書く", "priority": "high", "due": "2026-10-10"}（priority と due は省略できる）
	record CardCreateRequest(
			@NotBlank @Size(max = 200) String title,
			@Pattern(regexp = "high|mid|low") String priority,
			LocalDate due) {
	}

	// 変更：送った項目だけ変わる。{"due": null} を送ると期限を消す
	static class CardUpdateRequest {

		// 省略はできるが、空白だけのタイトルにはできない
		@Pattern(regexp = "(?s).*\\S.*", message = "空のタイトルにはできません")
		@Size(max = 200)
		private String title;

		@Pattern(regexp = "high|mid|low")
		private String priority;

		private LocalDate due;

		// JSON に due があったか（null を送ったときも true になる）
		private boolean dueSet;

		public void setTitle(String title) {
			this.title = title;
		}

		public void setPriority(String priority) {
			this.priority = priority;
		}

		public void setDue(LocalDate due) {
			this.due = due;
			this.dueSet = true;
		}

	}

	// 移動：{"listId": 2, "position": 0}（position は移動先リストでの 0 始まりの位置）
	record CardMoveRequest(@NotNull Long listId, @NotNull @Min(0) Integer position) {
	}

	private final BoardService boardService;

	public CardController(BoardService boardService) {
		this.boardService = boardService;
	}

	@PostMapping("/api/lists/{listId}/cards")
	@ResponseStatus(HttpStatus.CREATED)
	public CardResponse create(@PathVariable Long listId, @Valid @RequestBody CardCreateRequest request) {
		return boardService.createCard(listId, request.title().strip(), request.priority(), request.due());
	}

	@PatchMapping("/api/cards/{id}")
	public CardResponse update(@PathVariable Long id, @Valid @RequestBody CardUpdateRequest request) {
		String title = request.title == null ? null : request.title.strip();
		return boardService.updateCard(id, title, request.priority, request.dueSet, request.due);
	}

	@DeleteMapping("/api/cards/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(@PathVariable Long id) {
		boardService.deleteCard(id);
	}

	@PutMapping("/api/cards/{id}/move")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void move(@PathVariable Long id, @Valid @RequestBody CardMoveRequest request) {
		boardService.moveCard(id, request.listId(), request.position());
	}

}
