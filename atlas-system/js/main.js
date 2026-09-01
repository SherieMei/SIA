if(DB.currentUser){render()}else{location.href='../login/login.html'}
window.addEventListener('beforeunload',persistDB);
