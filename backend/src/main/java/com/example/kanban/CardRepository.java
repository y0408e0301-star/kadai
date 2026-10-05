package com.example.kanban;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

// JpaSpecificationExecutor：検索条件を組み合わせて findAll(条件) で探せるようにする
public interface CardRepository extends JpaRepository<Card, Long>, JpaSpecificationExecutor<Card> {

	List<Card> findAllByOrderByPositionAsc();

	List<Card> findByListIdOrderByPositionAsc(Long listId);

	// 末尾に追加するときの position を決めるのに使う。カードがなければ -1
	@Query("select coalesce(max(c.position), -1) from Card c where c.listId = :listId")
	int findMaxPosition(Long listId);

}
