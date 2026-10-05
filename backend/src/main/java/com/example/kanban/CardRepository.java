package com.example.kanban;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface CardRepository extends JpaRepository<Card, Long> {

	List<Card> findAllByOrderByPositionAsc();

	List<Card> findByListIdOrderByPositionAsc(Long listId);

	// 末尾に追加するときの position を決めるのに使う。カードがなければ -1
	@Query("select coalesce(max(c.position), -1) from Card c where c.listId = :listId")
	int findMaxPosition(Long listId);

}
