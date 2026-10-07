package com.example.kanban;

// 指定した id のリスト・カードがないとき（API では 404 になる。ApiExceptionHandler）
public class NotFoundException extends RuntimeException {

	private static final long serialVersionUID = 1L;

	public NotFoundException(String message) {
		super(message);
	}

}
