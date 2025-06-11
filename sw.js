// 서비스 워커 버전
const CACHE_NAME = 'kokoner-v1.0.0';
const urlsToCache = [
  '/',
  '/manifest.json',
  // 오프라인에서도 작동할 기본 리소스들
];

// 설치 이벤트
self.addEventListener('install', (event) => {
  console.log('서비스 워커 설치됨');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('캐시 열림');
        return cache.addAll(urlsToCache);
      })
  );
});

// 활성화 이벤트
self.addEventListener('activate', (event) => {
  console.log('서비스 워커 활성화됨');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 오래된 캐시 삭제
          if (cacheName !== CACHE_NAME) {
            console.log('오래된 캐시 삭제:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 네트워크 요청 가로채기
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 캐시에 있으면 캐시된 버전 반환
        if (response) {
          return response;
        }
        
        // 캐시에 없으면 네트워크에서 가져오기
        return fetch(event.request).then((response) => {
          // 유효한 응답이 아니면 그대로 반환
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // 응답을 복사해서 캐시에 저장
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        }).catch(() => {
          // 네트워크 오류 시 오프라인 페이지 표시
          if (event.request.destination === 'document') {
            return caches.match('/');
          }
        });
      })
  );
});

// 푸시 알림 수신
self.addEventListener('push', (event) => {
  console.log('푸시 메시지 수신:', event);
  
  const options = {
    body: event.data ? event.data.text() : '새로운 매칭이 있습니다!',
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'><circle cx='96' cy='96' r='80' fill='%23ff6b35'/><text x='96' y='130' text-anchor='middle' fill='white' font-size='80' font-family='Arial'>🎉</text></svg>",
    badge: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'><circle cx='48' cy='48' r='40' fill='%23ff6b35'/><text x='48' y='62' text-anchor='middle' fill='white' font-size='30'>🔍</text></svg>",
    vibrate: [200, 100, 200],
    tag: 'kokoner-match',
    requireInteraction: true,
    actions: [
      {
        action: 'view',
        title: '확인하기',
        icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%23ff6b35' d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z'/></svg>"
      },
      {
        action: 'dismiss',
        title: '나중에',
        icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%23666' d='M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'/></svg>"
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('꼬꼬너 🎉', options)
  );
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
  console.log('알림 클릭됨:', event);
  event.notification.close();
  
  if (event.action === 'view') {
    // 앱 열기
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'dismiss') {
    // 그냥 닫기
    console.log('알림 무시됨');
  } else {
    // 기본 클릭 - 앱 열기
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// 백그라운드 동기화 (선택사항)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('백그라운드 동기화 실행');
    event.waitUntil(
      // 백그라운드에서 새로운 매칭 확인
      fetch('/api/check-matches')
        .then(response => response.json())
        .then(data => {
          if (data.newMatches && data.newMatches.length > 0) {
            // 새로운 매칭 알림 표시
            return self.registration.showNotification('새로운 매칭! 🎯', {
              body: `${data.newMatches.length}명의 새로운 매칭이 발견되었습니다.`,
              icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'><circle cx='96' cy='96' r='80' fill='%23ff6b35'/><text x='96' y='130' text-anchor='middle' fill='white' font-size='80' font-family='Arial'>🎉</text></svg>",
              tag: 'new-matches',
              requireInteraction: true
            });
          }
        })
        .catch(err => console.log('백그라운드 동기화 실패:', err))
    );
  }
});

// 메시지 수신 (웹앱과 통신)
self.addEventListener('message', (event) => {
  console.log('서비스 워커 메시지 수신:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, icon } = event.data;
    self.registration.showNotification(title || '꼬꼬너', {
      body: body || '새로운 알림이 있습니다.',
      icon: icon || "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'><circle cx='96' cy='96' r='80' fill='%23ff6b35'/><text x='96' y='130' text-anchor='middle' fill='white' font-size='80' font-family='Arial'>🎉</text></svg>",
      tag: 'custom-notification'
    });
  }
});
