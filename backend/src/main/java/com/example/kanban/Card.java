package com.example.kanban;

import java.time.LocalDate;
import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

// cards テーブルの 1 行
@Entity
@Table(name = "cards")
public class Card {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	// 入っているリスト。リストの中身（名前など）は使うときに読む
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "list_id")
	private TaskList list;

	@Column(nullable = false, length = 200)
	private String title;

	@Column(nullable = false)
	private int position;

	// DB には high・mid・low で入る（PriorityAttributeConverter）
	@Column(nullable = false, length = 4)
	private Priority priority = Priority.MID;

	private LocalDate due;

	@CreationTimestamp
	@Column(name = "created_at", nullable = false, updatable = false)
	private LocalDateTime createdAt;

	@UpdateTimestamp
	@Column(name = "updated_at", nullable = false)
	private LocalDateTime updatedAt;

	protected Card() {
	}

	public Card(TaskList list, String title, int position) {
		this.list = list;
		this.title = title;
		this.position = position;
	}

	public Long getId() {
		return id;
	}

	public TaskList getList() {
		return list;
	}

	// リストを読まずに id だけ返す（Hibernate のプロキシは id を持っている）
	public Long getListId() {
		return list.getId();
	}

	public void setList(TaskList list) {
		this.list = list;
	}

	public String getTitle() {
		return title;
	}

	public void setTitle(String title) {
		this.title = title;
	}

	public int getPosition() {
		return position;
	}

	public void setPosition(int position) {
		this.position = position;
	}

	public Priority getPriority() {
		return priority;
	}

	public void setPriority(Priority priority) {
		this.priority = priority;
	}

	public LocalDate getDue() {
		return due;
	}

	public void setDue(LocalDate due) {
		this.due = due;
	}

}
