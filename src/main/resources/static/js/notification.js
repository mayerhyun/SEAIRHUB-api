// [✅ /static/js/notification.js 파일 전체를 이 최종 코드로 교체해주세요]
document.addEventListener('DOMContentLoaded', () => {
    const notificationArea = document.getElementById('notification-area');
    if (!notificationArea) return;

    const countElement = document.getElementById('notification-count');
    const listElement = document.getElementById('notification-list');
    const dropdown = document.getElementById('notification-dropdown');
    const notiBtn = notificationArea.querySelector('.notification-btn');
    const markAllReadBtn = document.getElementById('mark-all-read-btn');
    const notificationSound = new Audio('/sounds/notification.mp3');
    notificationSound.preload = 'auto';

    let retryCount = 0;
    const maxRetries = 5;
    let sseReconnectTimer = null;

    const updateCountUI = (count) => {
        const numericCount = parseInt(count, 10);
        countElement.textContent = numericCount;
        countElement.style.display = numericCount > 0 ? 'flex' : 'none';
        if (numericCount === 0 && dropdown.style.display === 'block') {
            showNoNotificationMessage();
        }
    };

    const prependNotificationToList = (noti) => {
        listElement.querySelector('.no-notifications')?.remove();
        const li = document.createElement('li');
        li.dataset.id = noti.id;
        li.dataset.url = noti.url;
        li.innerHTML = `<div class="message">${noti.message}</div><div class="timestamp">${noti.createdAt}</div>`;
        listElement.prepend(li);
    };

    const showNoNotificationMessage = () => {
        listElement.innerHTML = '<li class="no-notifications">새로운 알림이 없습니다.</li>';
    };

    const initializeNotifications = async () => {
        if (window.sseConnected) return;
        window.sseConnected = true;

        const fetcher = typeof fetchWithAuth === 'function' ? fetchWithAuth : fetch;
        try {
            const response = await fetcher('/api/notifications');
            if (!response.ok) throw new Error('알림 목록 로딩 실패');
            const notifications = await response.json();
            listElement.innerHTML = '';
            if (notifications.length > 0) {
                notifications.forEach(noti => {
                    const li = document.createElement('li');
                    li.dataset.id = noti.id;
                    li.dataset.url = noti.url;
                    li.innerHTML = `<div class="message">${noti.message}</div><div class="timestamp">${noti.createdAt}</div>`;
                    listElement.appendChild(li);
                });
            } else {
                showNoNotificationMessage();
            }
            updateCountUI(notifications.length);
        } catch (error) {
            if (error.message !== 'Session expired or forbidden') {
                console.error(error);
                listElement.innerHTML = '<li class="no-notifications">알림을 불러올 수 없습니다.</li>';
            }
        }

        const eventSource = new EventSource('/api/notifications/subscribe');

        eventSource.onopen = () => {
            console.log("SSE connection established.");
            retryCount = 0;
            if (sseReconnectTimer) clearTimeout(sseReconnectTimer);
        };

        // --- [✅ 핵심] 모든 SSE 이벤트를 수신하고 처리합니다 ---

        // 1. 일반 텍스트 알림 처리
        eventSource.addEventListener('notification', (event) => {
            try {
                const newNotification = JSON.parse(event.data);
                prependNotificationToList(newNotification);
                notificationSound.play().catch(e => console.log("Audio play was prevented by browser."));
            } catch (error) {
                console.error("Error processing 'notification' event:", error);
            }
        });
        
        // 2. 안읽은 알림 개수 업데이트
        eventSource.addEventListener('unreadCount', (event) => {
            updateCountUI(event.data);
        });

        // 3. 안읽은 채팅 개수 업데이트 (채팅 위젯으로 이벤트 전달)
        eventSource.addEventListener('unreadChat', (event) => {
            document.dispatchEvent(new CustomEvent('sse:unreadChat', { detail: event.data }));
        });

        // 4. 운송 상태 업데이트 (CUS_tracking, FWD_my_posted_requests 등)
        eventSource.addEventListener('shipment_update', (event) => {
            try {
                const { requestId, detailedStatus } = JSON.parse(event.data);
                const articleElement = document.querySelector(`article[data-request-id='${requestId}']`);
                if (!articleElement) return;

                const progressTracker = articleElement.querySelector('.progress-tracker-large');
                if (!progressTracker) return;

                const statusMap = {
                    'ACCEPTED': ['낙찰'], 'CONFIRMED': ['낙찰', '컨테이너 확정'], 'SHIPPED': ['낙찰', '컨테이너 확정', '선적완료'],
                    'COMPLETED': ['낙찰', '컨테이너 확정', '선적완료', '운송완료'], 'RESOLD': ['낙찰']
                };
                const stepsToComplete = statusMap[detailedStatus] || [];
                progressTracker.querySelectorAll('.step').forEach(step => {
                    const label = step.querySelector('.label').textContent.trim();
                    if (stepsToComplete.includes(label)) {
                        step.classList.add('is-complete');
                    }
                });
            } catch (error) {
                console.error("Error processing 'shipment_update' event:", error);
            }
        });

        // 5. 나의 제안 상태 업데이트 (FWD_my_offers)
        eventSource.addEventListener('offer_status_update', (event) => {
             try {
                const { offerId, status, statusText } = JSON.parse(event.data);
                const detailsButton = document.querySelector(`.btn-details[data-offer-id='${offerId}']`);
                if (!detailsButton) return;
    
                const offerCard = detailsButton.closest('.offer-card');
                if (!offerCard) return;
    
                const statusBadge = offerCard.querySelector('.status-badge');
                if (statusBadge) {
                    statusBadge.textContent = statusText;
                    statusBadge.className = 'status-badge';
                    statusBadge.classList.add(status.toLowerCase());
                }
    
                const actionsContainer = offerCard.querySelector('.actions');
                if (actionsContainer) {
                    actionsContainer.querySelector('.btn-cancel-offer')?.remove();
                    if (status === 'ACCEPTED') {
                        const resellButtonHTML = `<button class="btn btn-sm btn-resale" data-offer-id="${offerId}">재판매하기</button>`;
                        if (statusBadge) statusBadge.insertAdjacentHTML('afterend', resellButtonHTML);
                    } else if (status === 'REJECTED') {
                        actionsContainer.querySelector('.btn-resale')?.remove();
                    }
                }
            } catch (error) {
                console.error("Error processing 'offer_status_update' event:", error);
            }
        });
        
        // 6. 입찰 건수 업데이트 (CUS_request, FWD_my_posted_requests)
        eventSource.addEventListener('bid_count_update', (event) => {
            try {
                const { requestId, bidderCount } = JSON.parse(event.data);
                const articleElement = document.querySelector(`article[data-request-id='${requestId}']`);
                if (!articleElement) return;

                const bidderCountElement = articleElement.querySelector('.bidder-count');
                if (bidderCountElement) {
                    bidderCountElement.textContent = `제안 ${bidderCount}건 도착`;
                    bidderCountElement.style.transition = 'transform 0.2s ease';
                    bidderCountElement.style.transform = 'scale(1.2)';
                    setTimeout(() => {
                        bidderCountElement.style.transform = 'scale(1)';
                    }, 200);
                }
            } catch (error) {
                 console.error("Error processing 'bid_count_update' event:", error);
            }
        });

        // 7. 관리자 대시보드 업데이트
        eventSource.addEventListener('dashboard_update', (event) => {
            const dashboardCard = document.querySelector('.dashboard-grid');
            if (!dashboardCard) return;
            try {
                const metrics = JSON.parse(event.data);
                document.getElementById('today-requests').textContent = metrics.todayRequests;
                document.getElementById('today-deals').textContent = metrics.todayDeals;
                document.getElementById('total-fwd-users').textContent = metrics.totalFwdUsers;
                document.getElementById('total-cus-users').textContent = metrics.totalCusUsers;
                document.getElementById('pending-users').textContent = metrics.pendingUsers;
                document.getElementById('no-bid-requests').textContent = metrics.noBidRequests;
                document.getElementById('missed-confirmation-rate').textContent = metrics.missedConfirmationRate.toFixed(2) + '%';
            } catch (error) {
                console.error("Error processing 'dashboard_update' event:", error);
            }
        });

        // --- 8. [신규 기능] 다른 JS 파일로 이벤트를 전달(방송)하는 역할 ---
        const dispatchCustomEvent = (eventName, event) => {
             try {
                const data = JSON.parse(event.data);
                document.dispatchEvent(new CustomEvent(eventName, { detail: data }));
            } catch (e) {
                document.dispatchEvent(new CustomEvent(eventName, { detail: event.data }));
            }
        };
        
        eventSource.addEventListener('new_request', (event) => dispatchCustomEvent('sse:new_request', event));
        eventSource.addEventListener('request_status_update', (event) => dispatchCustomEvent('sse:request_status_update', event));


        eventSource.onerror = (error) => {
            console.error('SSE Error Occurred:', error);
            eventSource.close();
            window.sseConnected = false;
            if (++retryCount < maxRetries) {
                sseReconnectTimer = setTimeout(initializeNotifications, 5000 * retryCount);
            } else {
                console.error('SSE maximum retry limit reached.');
            }
        };
    };

    // --- 이하 페이지 상호작용 관련 코드는 기존과 동일 ---
    notiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    });

    listElement.addEventListener('click', async (e) => {
        const li = e.target.closest('li[data-id]');
        if (!li) return;
        const id = li.dataset.id;
        const url = li.dataset.url;
        const fetcher = typeof fetchWithAuth === 'function' ? fetchWithAuth : fetch;
        try {
            await fetcher(`/api/notifications/${id}/read`, { method: 'POST' });
            if (url && url !== 'null') window.location.href = url;
        } catch (error) { 
             if (error.message !== 'Session expired or forbidden') {
                console.error("알림 읽음 처리 실패:", error); 
             }
        }
    });

    markAllReadBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const fetcher = typeof fetchWithAuth === 'function' ? fetchWithAuth : fetch;
        try {
            await fetcher('/api/notifications/read/all', { method: 'POST' });
        } catch (error) { 
             if (error.message !== 'Session expired or forbidden') {
                console.error("모두 읽음 처리 실패:", error);
             }
        }
    });

    document.addEventListener('click', (e) => {
        if (!notificationArea.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
    
	initializeNotifications();
});