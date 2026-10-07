package com.example.kanban;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;

public interface TaskListRepository extends JpaRepository<TaskList, Long> {

	List<TaskList> findAllByOrderByPositionAsc();

	// リストの行をロックして読む（SELECT ... FOR UPDATE）。トランザクションが終わるまで、
	// 同じリストへのカードの追加・移動は待たされるので、position が重ならない
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select l from TaskList l where l.id = :id")
	Optional<TaskList> findByIdForUpdate(Long id);

	// 末尾に追加するときの position を決めるのに使う。リストがなければ -1
	@Query("select coalesce(max(l.position), -1) from TaskList l")
	int findMaxPosition();

}
