// -------------------
// 설정 및 초기화
// -------------------

// 본인의 Firebase 프로젝트 설정 값으로 교체하세요.
const firebaseConfig = {
    apiKey: "AIzaSyCWkpSlc2P0GccMcWE705HKMHQmwdnTo4c",
    authDomain: "breathoflife-ac0e7.firebaseapp.com",
    projectId: "breathoflife-ac0e7",
    storageBucket: "breathoflife-ac0e7.firebasestorage.app",
    messagingSenderId: "338476730148",
    appId: "1:338476730148:web:c8655d007ecf7b92ef95b1"
};

// 가나다순으로 정렬된 전체 진료과 목록
const ALL_DEPARTMENTS = [
    "가정의학과", "내과", "마취통증의학과", "병리과", "비뇨의학과", "산부인과",
    "성형외과", "소아청소년과", "신경외과", "안과", "영상의학과",
    "이비인후과", "재활의학과", "정신건강의학과", "정형외과", "직업환경의학과",
    "진단검사의학과", "피부과", "핵의학과", "흉부외과"
];

// Firebase 서비스 초기화
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();


// -------------------
// HTML 요소 가져오기
// -------------------
const authContainer = document.getElementById('auth-container');
const managementContainer = document.getElementById('management-container');
const loginContainer = document.getElementById('login-container');
const signupContainer = document.getElementById('signup-container');
const showSignupLink = document.getElementById('show-signup-link');
const showLoginLink = document.getElementById('show-login-link');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const logoutButton = document.getElementById('logout-button');
const managementTitle = document.getElementById('management-title');
const updateBedsButton = document.getElementById('update-beds-button');
const updateTotalBeds = document.getElementById('total-beds');
const updateAvailableBeds = document.getElementById('available-beds');
const updateMessage = document.getElementById('update-message');
const departmentSelect = document.getElementById('department-select');
const addDepartmentButton = document.getElementById('add-department-button');
const departmentTagsContainer = document.getElementById('department-tags-container');
const callsContainer = document.getElementById('calls-container');
const noCallsMessage = document.getElementById('no-calls-message');
const acceptedCallsContainer = document.getElementById('accepted-calls-container');
const noAcceptedCallsMessage = document.getElementById('no-accepted-calls-message');

// -------------------
// 전역 변수
// -------------------
let currentHospitalId = null;
let currentHospitalName = null; // 현재 병원 이름을 저장할 변수
let pendingCallsListener = null; // 대기중인 요청 리스너
let acceptedCallsListener = null; // 수락한 요청 리스너


// -------------------
// 핵심 기능 함수
// -------------------

// 진료과 드롭다운 목록 채우기
function populateDepartmentSelect() {
    departmentSelect.innerHTML = '<option value="">-- 진료과 선택 --</option>';
    ALL_DEPARTMENTS.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept;
        option.textContent = dept;
        departmentSelect.appendChild(option);
    });
}

// 진료과 태그 목록 화면에 표시
function renderDepartmentTags(departments = []) {
    departmentTagsContainer.innerHTML = '';
    departments.forEach(dept => {
        const tag = document.createElement('div');
        tag.className = 'department-tag';
        tag.textContent = dept;
        const removeBtn = document.createElement('span');
        removeBtn.className = 'remove-tag';
        removeBtn.textContent = 'x';
        removeBtn.onclick = () => removeDepartment(dept);
        tag.appendChild(removeBtn);
        departmentTagsContainer.appendChild(tag);
    });
}

// 진료과 추가
function addDepartment() {
    const selectedDept = departmentSelect.value;
    if (!selectedDept || !currentHospitalId) return;
    const hospitalDocRef = db.collection('hospitals').doc(currentHospitalId);
    hospitalDocRef.update({
        availableDepartments: firebase.firestore.FieldValue.arrayUnion(selectedDept)
    }).then(() => {
        db.collection('hospitals').doc(currentHospitalId).get().then(doc => renderDepartmentTags(doc.data().availableDepartments));
        departmentSelect.value = "";
    });
}

// 진료과 삭제
function removeDepartment(deptName) {
    if (!deptName || !currentHospitalId) return;
    const hospitalDocRef = db.collection('hospitals').doc(currentHospitalId);
    hospitalDocRef.update({
        availableDepartments: firebase.firestore.FieldValue.arrayRemove(deptName)
    }).then(() => {
        db.collection('hospitals').doc(currentHospitalId).get().then(doc => renderDepartmentTags(doc.data().availableDepartments));
    });
}

// 치료 완료: 병원 기록으로 데이터를 복사하고, 원본 요청은 삭제
function completeCase(callId, callData) {
    if (!currentHospitalId || !currentHospitalName) return;

    const batch = db.batch();

    // 1. 병원의 하위 컬렉션으로 환자 데이터 복사하여 영구 기록 생성
    const newCaseRef = db.collection('hospitals').doc(currentHospitalId).collection('completed_cases').doc(callId);
    const caseRecord = {
        ...callData,
        status: 'completed',
        acceptedHospitalName: currentHospitalName, // 병원 이름 저장
        caseCompletedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    batch.set(newCaseRef, caseRecord);

    // 2. 원본 요청 문서 삭제
    const originalCallRef = db.collection('emergency_calls').doc(callId);
    batch.delete(originalCallRef);

    batch.commit().then(() => {
        alert("환자 치료를 완료하고 병원 기록으로 이전했습니다.\n(원본 요청은 삭제되었습니다)");
    }).catch(error => {
        console.error("치료 완료 처리 오류:", error);
        alert("치료 완료 처리 중 오류가 발생했습니다.");
    });
}

// 응급 요청 수락
function acceptCall(callId) {
    if (!currentHospitalId || !currentHospitalName) return;
    const callDocRef = db.collection("emergency_calls").doc(callId);
    db.runTransaction(transaction => {
        return transaction.get(callDocRef).then(callDoc => {
            if (!callDoc.exists) throw "요청 문서를 찾을 수 없습니다.";
            if (callDoc.data().status !== 'pending') throw "이미 다른 병원에서 수락한 요청입니다.";
            transaction.update(callDocRef, {
                status: "accepted",
                acceptedHospitalId: currentHospitalId,
                acceptedHospitalName: currentHospitalName, // 수락 시에도 병원 이름 추가
                acceptedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
    }).then(() => {
        alert("응급 요청을 수락했습니다.");
    }).catch(error => {
        alert(`오류: ${error}`);
        const cardToRemove = document.getElementById(`pending-call-${callId}`);
        if (cardToRemove) cardToRemove.remove();
    });
}

// 응급 요청 거절
function rejectCall(callId) {
    db.collection("emergency_calls").doc(callId).update({
        rejectedBy: firebase.firestore.FieldValue.arrayUnion(currentHospitalId)
    });
}

// 대기 중인 응급 요청 리스너
function listenForPendingCalls() {
    if (pendingCallsListener) pendingCallsListener();
    const query = db.collection('emergency_calls').where('status', '==', 'pending');
    pendingCallsListener = query.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            const callData = change.doc.data();
            const callId = change.doc.id;
            const cardElement = document.getElementById(`pending-call-${callId}`);
            const isRejected = callData.rejectedBy && callData.rejectedBy.includes(currentHospitalId);

            if (isRejected || change.type === 'removed') {
                if (cardElement) cardElement.remove();
                return;
            }
            if (change.type === 'added' && !cardElement) {
                const card = createPendingCallCard(callId, callData);
                callsContainer.prepend(card);
            }
            if (change.type === 'modified') {
                if (cardElement) cardElement.remove();
            }
        });
        noCallsMessage.style.display = callsContainer.querySelectorAll('.call-card').length === 0 ? 'block' : 'none';
    }, error => console.error("대기 요청 리스너 오류:", error));
}

// 수락한 응급 요청 리스너
function listenForAcceptedCalls() {
    if (acceptedCallsListener) acceptedCallsListener();
    const query = db.collection('emergency_calls').where('acceptedHospitalId', '==', currentHospitalId).where('status', '==', 'accepted');
    acceptedCallsListener = query.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            const callData = change.doc.data();
            const callId = change.doc.id;
            const cardElement = document.getElementById(`accepted-call-${callId}`);

            if (change.type === 'removed' || (change.type === 'modified' && change.doc.data().status !== 'accepted')) {
                if (cardElement) cardElement.remove();
                return;
            }
            if (change.type === 'added' && !cardElement) {
                const card = createAcceptedCallCard(callId, callData);
                acceptedCallsContainer.prepend(card);
            }
        });
        noAcceptedCallsMessage.style.display = acceptedCallsContainer.querySelectorAll('.accepted-call-card').length === 0 ? 'block' : 'none';
    }, error => console.error("수락 요청 리스너 오류:", error));
}

// 대기 중인 요청 카드 HTML 생성
function createPendingCallCard(id, data) {
    const card = document.createElement('div');
    card.className = 'call-card';
    card.id = `pending-call-${id}`;
    const patient = data.patientInfo;
    const creationTime = data.createdAt ? data.createdAt.toDate().toLocaleTimeString('ko-KR') : '시간 없음';
    card.innerHTML = `
        <h3>환자: ${patient.name} (${patient.age}세, ${patient.gender})</h3>
        <p><strong>주요 증상:</strong> ${patient.symptom}</p>
        <p><strong>기타 정보:</strong> ${patient.otherInfo || '없음'}</p>
        <p><strong>요청 시각:</strong> ${creationTime}</p>
        <div class="call-actions">
            <button class="btn" data-action="accept" data-id="${id}">수락</button>
            <button class="btn btn-secondary" data-action="reject" data-id="${id}">거절</button>
        </div>
    `;
    return card;
}

// 수락한 요청 카드 HTML 생성
function createAcceptedCallCard(id, data) {
    const card = document.createElement('div');
    card.className = 'accepted-call-card';
    card.id = `accepted-call-${id}`;
    const patient = data.patientInfo;
    const acceptedTime = data.acceptedAt ? data.acceptedAt.toDate().toLocaleTimeString('ko-KR') : '시간 없음';
    card.innerHTML = `
        <h3>환자: ${patient.name} (${patient.age}세, ${patient.gender})</h3>
        <p><strong>주요 증상:</strong> ${patient.symptom}</p>
        <p><strong>수락 시각:</strong> ${acceptedTime}</p>
        <div class="accepted-call-actions">
            <button class="btn" data-action="complete" data-id="${id}">치료 완료</button>
        </div>
    `;
    card.querySelector('button[data-action="complete"]').addEventListener('click', () => {
        if (confirm(`${patient.name} 환자의 치료를 완료하고 기록을 저장하시겠습니까?`)) {
            completeCase(id, data);
        }
    });
    return card;
}


// -------------------
// 이벤트 리스너 설정
// -------------------

// 화면 전환
showSignupLink.addEventListener('click', (e) => { e.preventDefault(); loginContainer.style.display = 'none'; signupContainer.style.display = 'block'; });
showLoginLink.addEventListener('click', (e) => { e.preventDefault(); signupContainer.style.display = 'none'; loginContainer.style.display = 'block'; });

// 로그인
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    auth.signInWithEmailAndPassword(email, password).catch(error => {
        let msg = "로그인 중 오류가 발생했습니다.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') msg = "이메일 또는 비밀번호가 올바르지 않습니다.";
        alert(msg);
    });
});

// 회원가입
signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const hospitalName = document.getElementById('hospital-name').value;
    const address = document.getElementById('hospital-address').value;
    const lat = document.getElementById('hospital-lat').value;
    const lon = document.getElementById('hospital-lon').value;

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) {
        alert("유효한 위도와 경도를 숫자로 입력해주세요.");
        return;
    }

    auth.createUserWithEmailAndPassword(email, password)
        .then(userCredential => {
            const batch = db.batch();
            const hospitalRef = db.collection('hospitals').doc();
            batch.set(hospitalRef, {
                hospitalName: hospitalName,
                address: { full: address },
                location: new firebase.firestore.GeoPoint(latitude, longitude),
                beds: { total: 20, available: 5, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() },
                availableDepartments: []
            });
            const userRef = db.collection('users').doc(userCredential.user.uid);
            batch.set(userRef, { email, name: "병원 관리자", role: 'hospital', hospitalId: hospitalRef.id });
            return batch.commit();
        })
        .then(() => alert('회원가입이 완료되었습니다. 자동으로 로그인됩니다.'))
        .catch(error => {
            let msg = `회원가입 중 오류가 발생했습니다: ${error.message}`;
            if (error.code === 'auth/email-already-in-use') msg = "이미 사용 중인 이메일입니다.";
            alert(msg);
        });
});

// 로그아웃
logoutButton.addEventListener('click', () => auth.signOut());

// 병상 업데이트
updateBedsButton.addEventListener('click', () => {
    if (!currentHospitalId) return;
    const totalBeds = parseInt(updateTotalBeds.value, 10);
    const availableBeds = parseInt(updateAvailableBeds.value, 10);
    if (isNaN(totalBeds) || isNaN(availableBeds) || totalBeds < 0 || availableBeds < 0 || availableBeds > totalBeds) {
        alert("병상 수를 올바르게 입력해주세요.");
        return;
    }
    db.collection('hospitals').doc(currentHospitalId).update({
        'beds.total': totalBeds, 'beds.available': availableBeds, 'beds.lastUpdated': firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        updateMessage.textContent = '업데이트 완료! (' + new Date().toLocaleTimeString() + ')';
        setTimeout(() => updateMessage.textContent = '', 3000);
    });
});

// 진료과 추가
addDepartmentButton.addEventListener('click', addDepartment);

// 대기중인 요청 수락/거절 (이벤트 위임)
callsContainer.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON' || !e.target.dataset.action) return;
    const { action, id } = e.target.dataset;
    if (action === 'accept') {
        if (confirm("이 응급 요청을 수락하시겠습니까?")) acceptCall(id);
    } else if (action === 'reject') {
        rejectCall(id);
    }
});


// ------------------------
// 인증 상태 변경 리스너 (메인 로직)
// ------------------------
auth.onAuthStateChanged(user => {
    if (user) {
        // --- 로그인 시 ---
        authContainer.style.display = 'none';
        managementContainer.style.display = 'block';
        db.collection('users').doc(user.uid).get().then(userDoc => {
            if (!userDoc.exists) { auth.signOut(); return Promise.reject("User doc not found."); }
            currentHospitalId = userDoc.data().hospitalId;
            return db.collection('hospitals').doc(currentHospitalId).get();
        }).then(hospitalDoc => {
            if (!hospitalDoc.exists) { auth.signOut(); return Promise.reject("Hospital doc not found."); }
            const hospitalData = hospitalDoc.data();
            currentHospitalName = hospitalData.hospitalName;
            managementTitle.textContent = `${hospitalData.hospitalName} 응급실 관리`;
            updateTotalBeds.value = hospitalData.beds.total;
            updateAvailableBeds.value = hospitalData.beds.available;
            renderDepartmentTags(hospitalData.availableDepartments);

            listenForPendingCalls();
            listenForAcceptedCalls();
        }).catch(error => {
            console.error("데이터 로드 중 오류:", error);
            auth.signOut();
        });
    } else {
        // --- 로그아웃 시 ---
        authContainer.style.display = 'block';
        managementContainer.style.display = 'none';
        loginForm.reset();
        signupForm.reset();
        signupContainer.style.display = 'none';
        loginContainer.style.display = 'block';
        currentHospitalId = null;
        currentHospitalName = null;

        if (pendingCallsListener) pendingCallsListener();
        if (acceptedCallsListener) acceptedCallsListener();

        callsContainer.innerHTML = '<p id="no-calls-message">현재 대기 중인 응급 요청이 없습니다.</p>';
        acceptedCallsContainer.innerHTML = '<p id="no-accepted-calls-message">현재 치료 중인 환자가 없습니다.</p>';
    }
});

// --- 앱 시작 시 초기화 ---
populateDepartmentSelect();

firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
        try {
            // 1. 사용자 UID로 users/{uid} 문서 가져오기
            const userDoc = await db.collection("users").doc(user.uid).get();
            if (!userDoc.exists) throw new Error("❌ 사용자 문서 없음");

            // 2. 문서 안의 hospitalId 필드 가져오기 (이게 진짜 병원 Firestore ID)
            const hospitalId = userDoc.data().hospitalId;
            console.log("🏥 로그인한 병원의 Firestore ID:", hospitalId);

            // 3. 요약 분석 요청
            fetchAISummary(hospitalId);

        } catch (error) {
            console.error("🚨 병원 ID 로딩 실패:", error);
            document.getElementById("ai-summary-container").innerText = "❌ 병원 데이터를 불러올 수 없습니다.";
        }
    } else {
        // 로그아웃 처리
        document.getElementById("auth-container").style.display = "block";
        document.getElementById("management-container").style.display = "none";
    }
});


async function fetchAISummary(hospitalId) {
    console.log("✅ fetchAISummary 전달 ID:", hospitalId);  // 👈 이 줄 추가

    try {
        const res = await fetch(`http://127.0.0.1:8083/api/ai-summary?hospital_id=${hospitalId}`);
        const data = await res.json();
        console.log("📦 AI 요약 응답:", data);
        document.getElementById("ai-summary-container").innerHTML = `<pre>${data.result}</pre>`;
    } catch (err) {
        console.error("❌ AI 분석 실패:", err);
        document.getElementById("ai-summary-container").innerText = "❌ AI 분석 실패";
    }
}






