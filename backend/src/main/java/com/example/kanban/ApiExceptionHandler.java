package com.example.kanban;

import java.util.stream.Collectors;

import org.jspecify.annotations.Nullable;
import org.springframework.beans.TypeMismatchException;
import org.springframework.context.MessageSourceResolvable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

// API のエラーを RFC 9457（Problem Details）の形の JSON で返す。
// {"title":"Not Found","status":404,"detail":"カードが見つかりません（id: 5）","instance":"/api/cards/5"}
// detail には画面にそのまま出せる日本語の理由を入れる。Spring MVC の標準のエラー（JSON が読めない・入力チェック違反など）は
// ResponseEntityExceptionHandler が Problem Details にし、ここでは detail だけを分かりやすくする
@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {

	@ExceptionHandler(NotFoundException.class)
	ProblemDetail handleNotFound(NotFoundException ex) {
		return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
	}

	// リクエストの本文（JSON）の入力チェック違反。例：{"title": ""}
	@Override
	protected @Nullable ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex,
			HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		String fields = ex.getBindingResult()
			.getFieldErrors()
			.stream()
			.map(ApiExceptionHandler::describe)
			.collect(Collectors.joining("、"));
		ex.getBody().setDetail("入力が正しくありません（" + fields + "）");
		return handleExceptionInternal(ex, null, headers, status, request);
	}

	// クエリパラメーターの入力チェック違反。例：GET /api/cards?q=（201 文字）
	@Override
	protected @Nullable ResponseEntity<Object> handleHandlerMethodValidationException(
			HandlerMethodValidationException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		String params = ex.getParameterValidationResults()
			.stream()
			.map(r -> r.getMethodParameter().getParameterName() + ": "
					+ r.getResolvableErrors()
						.stream()
						.map(MessageSourceResolvable::getDefaultMessage)
						.collect(Collectors.joining("・")))
			.collect(Collectors.joining("、"));
		ex.getBody().setDetail("入力が正しくありません（" + params + "）");
		return handleExceptionInternal(ex, null, headers, status, request);
	}

	// JSON の形が崩れている、日付や優先順位の値がおかしい。例：{"due": "2026/10/10"}、{"priority": "top"}
	@Override
	protected @Nullable ResponseEntity<Object> handleHttpMessageNotReadable(HttpMessageNotReadableException ex,
			HttpHeaders headers, HttpStatusCode status, WebRequest request) {
		ProblemDetail body = ProblemDetail.forStatusAndDetail(status,
				"送られた JSON を読めません（形式か値が正しくありません。日付は YYYY-MM-DD、優先順位は high・mid・low）");
		return handleExceptionInternal(ex, body, headers, status, request);
	}

	// クエリパラメーター・パスの値の型が違う。例：GET /api/cards?dueFrom=10/10、?priority=top
	@Override
	protected @Nullable ResponseEntity<Object> handleTypeMismatch(TypeMismatchException ex, HttpHeaders headers,
			HttpStatusCode status, WebRequest request) {
		ProblemDetail body = ProblemDetail.forStatusAndDetail(status,
				"パラメーター " + ex.getPropertyName() + " の値が正しくありません: " + ex.getValue());
		return handleExceptionInternal(ex, body, headers, status, request);
	}

	private static String describe(FieldError error) {
		return error.getField() + ": " + error.getDefaultMessage();
	}

}
