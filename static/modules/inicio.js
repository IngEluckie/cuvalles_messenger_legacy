// inicio.js

(()=>{
    const token = localStorage.getItem("jwt")
    if (!token) {
        window.location.href = "login.html"
    } else {
        window.location.href = "dashboard.html"
    }
})()