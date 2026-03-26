package net.dima.project.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * SSE를 통해 클라이언트에게 요청(Request)의 상태 변경을 알리기 위한 DTO입니다.
 * 예: 요청이 'OPEN'에서 'CLOSED'로 변경되었을 때 사용됩니다.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RequestStatusUpdateDto {

    /**
     * 상태가 변경된 요청의 고유 ID
     */
    private Long requestId;

    /**
     * 새로 변경된 상태 (예: "CLOSED")
     */
    private String newStatus;
}