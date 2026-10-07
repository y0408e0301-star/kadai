package com.example.kanban;

import java.util.List;

import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

// JpaSpecificationExecutor：検索条件を組み合わせて findAll(条件) で探せるようにする
public interface CardRepository extends JpaRepository<Card, Long>, JpaSpecificationExecutor<Card> {

	List<Card> findAllByOrderByPositionAsc();

	// メソッド名からクエリを作ると Card.getListId() と紛らわしいので、JPQL で書く
	@Query("select c from Card c where c.list.id = :listId order by c.position")
	List<Card> findByListIdOrderByPositionAsc(Long listId);

	// 検索。入っているリストも 1 回の SQL（JOIN）で一緒に読む
	@Override
	@EntityGraph(attributePaths = "list")
	List<Card> findAll(Specification<Card> spec);

	// 末尾に追加するときの position を決めるのに使う。カードがなければ -1
	@Query("select coalesce(max(c.position), -1) from Card c where c.list.id = :listId")
	int findMaxPosition(Long listId);

}
