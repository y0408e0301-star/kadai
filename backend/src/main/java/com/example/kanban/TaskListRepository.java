package com.example.kanban;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface TaskListRepository extends JpaRepository<TaskList, Long> {

	List<TaskList> findAllByOrderByPositionAsc();

	// 末尾に追加するときの position を決めるのに使う。リストがなければ -1
	@Query("select coalesce(max(l.position), -1) from TaskList l")
	int findMaxPosition();

}
