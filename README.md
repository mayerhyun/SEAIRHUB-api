#  SeairHub (씨에어허브)

**포워더와 화주를 연결하는 B2B 수출입 물류 플랫폼**

##  프로젝트 개요

SeairHub는 화물 운송을 필요로 하는 **화주(Customer/Shipper)**와 운송 서비스를 제공하는 **포워더(Forwarder)** 간의 B2B 거래를 지원하는 통합 물류 플랫폼입니다. 국제물류 도메인 지식을 바탕으로 기획되었으며, **역경매 입찰 시스템**을 통한 운송 비용 절감과 **스페이스 전매 시스템**을 통한 컨테이너 공간의 효율적 활용을 목표로 합니다.

##  기술 스택

| 영역 | 기술 |
| :--- | :--- |
| **Backend** | Java 17, Spring Boot 3.x, Spring Security, Spring Data JPA |
| **Database** | MySQL 8.x |
| **Frontend** | Thymeleaf, HTML5, CSS3, JavaScript (Vanilla / jQuery 3.7.1) |
| **Real-time** | WebSocket (1:1 채팅), SSE (실시간 알림) |
| **Auth** | OAuth2 Client (Kakao, Naver), BCrypt 암호화 |
| **Build/Deploy** | Gradle |

##  주요 기능

### 1. 권한 기반 인증 (Auth)
* 화주(`ROLE_CUS`), 포워더(`ROLE_FWD`), 관리자(`ROLE_ADM`) 권한 분리 및 라우팅
* 일반 이메일 회원가입 및 소셜 로그인 (카카오, 네이버) 통합 지원
* 소셜 로그인 시 B2B 필수 정보(사업자 등록 번호 등) 추가 입력 프로세스 처리

### 2. 화물 운송 역경매 (Reverse Auction)
* **화주(CUS):** 출발/도착지, 일정, 화물 상세 정보(LCL/FCL, 체적, 무게)가 포함된 운송 요청(Request) 등록
* **포워더(FWD):** 등록된 화물 요청을 조회하고, 조건에 맞는 운임 견적(Offer)을 제시하여 입찰 참여
* **상태 동기화:** 요청 상태(`PENDING` → `BIDDING` → `ACCEPTED`) 및 견적 상태(`SUBMITTED` → `ACCEPTED` / `REJECTED`)의 트랜잭션 기반 관리

### 3. 스페이스 전매 (Space Resale)
* 포워더가 확보한 잔여 컨테이너 공간(Container)을 시스템에 등록 및 관리
* 타 포워더 또는 화주가 조건에 맞는 잔여 스페이스를 검색하고 거래할 수 있는 기능

### 4. 실시간 커뮤니케이션 (Real-time)
* **1:1 채팅:** WebSocket(`ChatWebController`, `ChatService`)을 활용하여 화주와 포워더 간의 운임 네고 및 상세 조건 협의 지원
* **실시간 알림:** SSE(`SseEmitterService`)를 활용하여 새로운 입찰 등록, 낙찰 결과, 새 메시지 수신 시 즉각적인 화면 알림(`notification.js`) 제공

### 5. 대시보드 및 통계 (Dashboard)
* SCFI(상하이컨테이너운임지수) 데이터 연동 및 시각화 (`ScfiDataRepository`)
* 관리자(ADM) 및 사용자별 거래 내역(Transaction History) 통계 제공

## 🧑‍💻 내 담당 기능

본 프로젝트에서 백엔드 개발자로서 다음 핵심 기능을 전담하여 설계 및 구현했습니다.

**1. 회원가입 및 로그인 (일반/소셜 로그인 통합)**
* `Spring Security`를 활용하여 권한별(CUS/FWD) 접근 제어 필터 체인(`SecurityConfig.java`) 설계.
* 일반 로그인과 `OAuth2` 기반 소셜 로그인(Kakao, Naver) 로직 통합.
* 커스텀 핸들러(`CustomAuthenticationSuccessHandler`, `CustomOAuth2FailureHandler`)를 구현하여 소셜 로그인 최초 접근 시 사업자 정보 추가 입력 폼으로 리다이렉트하는 B2B 맞춤형 인증 흐름 구축.

**2. 화물 운송 역경매 시스템 (재판매 제외)**
* 화주(CUS)의 화물 운송 요청(`RequestEntity`) CRUD API 설계 및 구현.
* 포워더(FWD)의 견적(`OfferEntity`) 입찰 비즈니스 로직 및 DTO(`OfferRequestDto`, `UpdateOfferDto`) 매핑 구현.
* 화주가 특정 포워더의 견적을 낙찰(Accept)할 경우, 해당 견적은 승인 상태로 변경하고 경쟁하던 타 포워더의 견적은 일괄 유찰(Reject) 처리되도록 JPA `@Transactional`을 통한 데이터 정합성 보장.

##  프로젝트 구조

계층형 아키텍처(Layered Architecture)를 기반으로 도메인 모델과 뷰를 명확히 분리하여 구현했습니다.

```text
seairhub/
├── src/main/java/net/dima/project/
│   ├── ProjectApplication.java
│   │
│   ├── config/                      # 전역 설정
│   │   ├── SecurityConfig.java      # Spring Security 설정
│   │   ├── WebSocketConfig.java     # STOMP/WebSocket 설정
│   │   ├── CustomAuthenticationSuccessHandler.java
│   │   └── CustomOAuth2FailureHandler.java
│   │
│   ├── controller/                  # 웹 뷰 라우팅 및 REST API
│   │   ├── AdminController.java / AdminApiController.java
│   │   ├── CusController.java / CusApiController.java
│   │   ├── FwdController.java / FwdApiController.java
│   │   ├── UserController.java / MyPageController.java
│   │   ├── ChatController.java / ChatApiController.java / ChatWebController.java
│   │   ├── NotificationController.java
│   │   ├── DataApiController.java
│   │   ├── FileDownloadController.java
│   │   └── MainController.java
│   │
│   ├── dto/                         # 데이터 전송 객체 (Data Transfer Object)
│   │   ├── (User): UserDTO, UserInfoDto, LoginUserDetails, ForwarderInfoDto, MyInfoDto
│   │   ├── (Request/Offer): NewRequestDto, RequestCardDto, OfferDto, MyOfferDto, RequestStatusUpdateDto, BidderDto, BidCountUpdateDto, UpdateOfferDto, OfferStatusUpdateDto, OfferRequestDto, MyRequestStatusDto, MyPostedRequestDto, MyOfferDetailDto
│   │   ├── (Cargo/Container): CargoDetailDto, ContainerStatusDto, CreateContainerDto, AvailableContainerDto, ExternalCargoDto, VolumeDto
│   │   ├── (Chat/Notice): ChatMessageDto, ChatRoomDto, NotificationDto
│   │   └── (Etc): DashboardMetricsDto, BlDto, ScfiDataDto, ShipmentStatusUpdateDto, TransactionHistoryDto
│   │
│   ├── entity/                      # JPA 엔티티 및 Enum 모델
│   │   ├── UserEntity.java
│   │   ├── RequestEntity.java / RequestStatus.java
│   │   ├── OfferEntity.java / OfferStatus.java
│   │   ├── CargoEntity.java
│   │   ├── ContainerEntity.java / ContainerStatus.java / ContainerCargoEntity.java
│   │   ├── ChatRoom.java / ChatRoomStatus.java / ChatMessage.java / ChatParticipant.java
│   │   ├── Notification.java / NotificationEvents.java
│   │   └── ScfiData.java
│   │
│   ├── repository/                  # Spring Data JPA 리포지토리
│   │   ├── UserRepository.java
│   │   ├── RequestRepository.java
│   │   ├── OfferRepository.java
│   │   ├── CargoRepository.java
│   │   ├── ContainerRepository.java / ContainerCargoRepository.java
│   │   ├── ChatRoomRepository.java / ChatMessageRepository.java / ChatParticipantRepository.java
│   │   ├── NotificationRepository.java
│   │   └── ScfiDataRepository.java
│   │
│   └── service/                     # 비즈니스 로직
│       ├── LoginService.java / UserService.java / MyPageService.java
│       ├── KakaoService.java / NaverService.java
│       ├── RequestService.java / RequestScheduler.java
│       ├── OfferService.java
│       ├── ResaleService.java
│       ├── ContainerService.java
│       ├── ChatService.java
│       ├── NotificationService.java / NotificationEventListener.java / SseEmitterService.java
│       ├── TransactionHistoryService.java
│       └── AdminService.java
│
└── src/main/resources/
    ├── application.properties       # DB, OAuth2 환경 변수
    ├── SQL/
    │   └── schema.sql               # 초기 DB 스키마
    ├── static/                      # 정적 리소스 (CSS, JS, 이미지, 음원)
    │   ├── css/                     # base, components, layout, login 및 페이지별 css
    │   ├── js/                      # jquery-3.7.1, 기능별 js (chat.js, notification.js 등)
    │   ├── images/
    │   └── sounds/                  # 알림음 (notification.mp3 등)
    └── templates/                   # Thymeleaf HTML 뷰
        ├── adm/                     # 관리자 페이지 (대시보드, 유저 관리)
        ├── cus/                     # 화주 페이지 (요청 등록, 히스토리)
        ├── fwd/                     # 포워더 페이지 (견적 입찰, 스페이스 전매)
        ├── user/                    # 로그인, 회원가입, 롤 선택
        ├── fragments/               # 헤더, 사이드바 레이아웃
        ├── chat.html                # 채팅 팝업/화면
        └── index.html               # 메인 페이지

 핵심 도메인 모델
UserEntity: 사용자 정보 (CUS/FWD 권한 분리)

RequestEntity: 화주가 등록한 화물 운송 요청 (N:1 UserEntity)

OfferEntity: 포워더가 입찰한 운임 견적 (N:1 RequestEntity, N:1 UserEntity)

CargoEntity / ContainerEntity: 화물 및 컨테이너 스페이스 전매 관리를 위한 모델

ChatRoom / ChatMessage: 역경매 및 전매 과정에서의 협의를 위한 1:1 채팅 모델
