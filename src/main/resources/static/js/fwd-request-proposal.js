// [✅ 이 코드로 fwd-request-proposal.js 파일 전체를 교체해주세요]
document.addEventListener('DOMContentLoaded', () => {
    const requestList = document.querySelector('.request-list');
    const offerFormTemplate = document.getElementById('offer-form-template');

    // 이 페이지에 필요한 요소가 없으면, 특히 SSE 관련 로직은 등록하지 않습니다.
    if (!requestList || !offerFormTemplate) {
        return;
    }

    // --- 1. 견적 제안 폼 관련 로직 (클릭 이벤트) ---
    // (이 부분은 기존 코드와 동일하며, 오류 가능성을 수정한 최종 버전입니다.)
    const closeOpenOfferForm = () => {
        const openForm = document.querySelector('.offer-form-expand');
        if (openForm) {
            openForm.previousElementSibling?.classList.remove('is-expanded');
            openForm.remove();
        }
    };

    requestList.addEventListener('click', async (e) => {
        const quoteButton = e.target.closest('.btn-quote');
        if (!quoteButton || quoteButton.disabled) return;

        const card = quoteButton.closest('.request-card');
        if (!card) return;
        
        if (card.classList.contains('is-expanded')) {
            closeOpenOfferForm();
            return;
        }
        
        closeOpenOfferForm();
        
        const requestId = card.dataset.requestId;
        const requestCbm = parseFloat(card.dataset.requestCbm);
        const desiredArrivalDateString = card.dataset.desiredArrivalDate;

        try {
            card.classList.add('is-expanded');
            
            const fetcher = typeof fetchWithAuth === 'function' ? fetchWithAuth : fetch;
            const response = await fetcher(`/api/fwd/available-containers?requestId=${requestId}`);
            if (!response.ok) throw new Error(`컨테이너 목록 로딩 실패 (Error: ${response.status})`);
            
            const availableContainers = await response.json();
            const formClone = offerFormTemplate.content.cloneNode(true);
            const formWrapper = formClone.querySelector('.offer-form-expand');
            
            card.after(formWrapper);
            
            const containerSelect = formWrapper.querySelector('.container-select');
            const capacityInput = formWrapper.querySelector('.available-capacity');
            const priceInput = formWrapper.querySelector('.bid-price');
            const currencySelect = formWrapper.querySelector('.currency-select');
            const statusText = formWrapper.querySelector('.form-status');
            const submitBtn = formWrapper.querySelector('.btn-submit-bid');
            const cancelBtn = formWrapper.querySelector('.btn-cancel');

            if (availableContainers.length > 0) {
                availableContainers.forEach(c => {
                    const option = new Option(`${c.containerDisplayName}`, c.containerId);
                    option.dataset.availableCbm = c.availableCbm;
                    option.dataset.eta = c.eta;
                    containerSelect.appendChild(option);
                });
            } else {
                statusText.innerHTML = `<strong class="impossible">제안 가능한 컨테이너 없음</strong>`;
            }

            containerSelect.addEventListener('change', () => {
                const selectedOption = containerSelect.options[containerSelect.selectedIndex];
                if (!selectedOption.value) {
                    capacityInput.value = '컨테이너 선택 시 자동 입력';
                    statusText.textContent = '';
                    submitBtn.disabled = true;
                    return;
                }
                
                const availableCbm = parseFloat(selectedOption.dataset.availableCbm);
                capacityInput.value = `${availableCbm.toFixed(2)} CBM`;
                
                const isCbmOk = availableCbm >= requestCbm;
                let isDateOk = true;
                let reason = "";
                
                if (desiredArrivalDateString && desiredArrivalDateString !== 'null' && desiredArrivalDateString !== '미지정') {
                     const desiredArrival = new Date(desiredArrivalDateString);
                     const containerEta = new Date(selectedOption.dataset.eta);
                     desiredArrival.setHours(0, 0, 0, 0);
                     containerEta.setHours(0, 0, 0, 0);
                     const dayDiff = (containerEta - desiredArrival) / (1000 * 3600 * 24);
                     isDateOk = dayDiff <= 3;
                     reason = !isDateOk ? '도착 희망일보다 3일 이상 늦습니다.' : '';
                }

                if (isCbmOk && isDateOk) {
                    statusText.innerHTML = `<strong class="possible">견적제안 가능</strong>합니다.`;
                    submitBtn.disabled = false;
                } else {
                    let finalReason = !isCbmOk ? '잔여 용량이 부족합니다.' : reason;
                    statusText.innerHTML = `<strong class="impossible">제안 불가</strong> (${finalReason})`;
                    submitBtn.disabled = true;
                }
            });

            cancelBtn.addEventListener('click', closeOpenOfferForm);
            submitBtn.addEventListener('click', async () => {
                if (!priceInput.value || priceInput.value <= 0 || !containerSelect.value) {
                    alert('컨테이너 선택 및 입찰가를 정확히 입력해주세요.');
                    return;
                }
                const offerData = { requestId, containerId: containerSelect.value, price: priceInput.value, currency: currencySelect.value };
                const postFetcher = typeof fetchWithAuth === 'function' ? fetchWithAuth : fetch;
                try {
                    const submitResponse = await postFetcher('/api/fwd/offers', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(offerData)
                    });
                    const message = await submitResponse.text();
                    alert(message);
                    if (submitResponse.ok) window.location.href = '/fwd/my-offers';
                } catch (error) {
                    if (error.message !== 'Session expired or forbidden') {
                         console.error('Submit error:', error);
                         alert('제안 제출 중 오류가 발생했습니다.');
                    }
                }
            });

        } catch (error) {
            if (error.message !== 'Session expired or forbidden') {
                 console.error('Fetch error:', error);
                 alert('오류가 발생했습니다: ' + error.message);
            }
            if(card) card.classList.remove('is-expanded');
        }
    });
    
    // --- 2. [✅ 핵심] 재판매 건 실시간 추가를 위한 SSE 이벤트 리스너 ---
    document.addEventListener('sse:new_request', (event) => {
        const newRequest = event.detail;
        
        if (document.querySelector(`.request-card[data-request-id='${newRequest.id}']`)) return;
        requestList.querySelector('.no-results-message')?.remove();
        
        const newCardHtml = `
            <article class="card request-card"
                     data-request-id="${newRequest.id}" data-request-cbm="${newRequest.cbm}"
                     data-requester-id="${newRequest.requesterId}" data-has-my-offer="false"
                     data-deadline-datetime="${newRequest.deadlineDateTime}"
                     data-desired-arrival-date="${newRequest.desiredArrivalDateAsLocalDate}">
                <div class="info">
                    <span class="id-label">${newRequest.idLabel}</span>
                    <h3 class="item-name">${newRequest.itemName}</h3>
                    <div class="details">
                        <span class="incoterms">${newRequest.incoterms}</span>
                        <span class="port departure">${newRequest.departurePort}</span> → <span class="port arrival">${newRequest.arrivalPort}</span>
                        <span class="desired-arrival" style="font-weight: 500; color: #007bff; margin-left: 12px;"> 도착희망: ${newRequest.desiredArrivalDate}</span>
                        <span class="date-info" style="margin-left: 8px;">등록: ${newRequest.registrationDate}</span>
                        <span class="deadline" style="margin-left: 8px;">마감: ${newRequest.deadline}</span>
                    </div>
                </div>
                <div class="meta">
                    <div class="type"><p class="trade-type">${newRequest.tradeType}</p><p class="transport-type">${newRequest.transportType}</p></div>
                    <div class="cbm">${parseFloat(newRequest.cbm).toFixed(2)} CBM</div>
                </div>
                <div class="actions">
                    <button class="btn btn-timer btn-danger" data-deadline-datetime="${newRequest.deadlineDateTime}"></button>
                    <button class="btn btn-quote btn-primary">견적제안</button>
                </div>
            </article>`;

        requestList.insertAdjacentHTML('afterbegin', newCardHtml);
        
        const newCardElement = requestList.firstElementChild;
        newCardElement.style.animation = 'flash 1s ease-out';
        
        if (typeof window.updateAllTimers === 'function') window.updateAllTimers();
    });

    // --- 3. [✅ 핵심] 낙찰된 건 자동 숨김/변경을 위한 SSE 이벤트 리스너 ---
    document.addEventListener('sse:request_status_update', (event) => {
        const { requestId, newStatus } = event.detail;
        const requestCard = document.querySelector(`.request-card[data-request-id='${requestId}']`);

        if (requestCard && newStatus === 'CLOSED') {
            const excludeClosedFilter = document.querySelector('.filter-group a[href*="excludeClosed=true"].is-active');
            if (excludeClosedFilter) {
                requestCard.style.transition = 'opacity 0.5s ease-out';
                requestCard.style.opacity = '0';
                setTimeout(() => {
                    requestCard.remove();
                    if (requestList.children.length === 0) {
                        requestList.innerHTML = '<p class="no-results-message">조회된 요청이 없습니다.</p>';
                    }
                }, 500);
            } else {
                const actionsDiv = requestCard.querySelector('.actions');
                if (actionsDiv) {
                    actionsDiv.innerHTML = '<span class="status-badge closed">마감</span>';
                }
            }
        }
    });
});