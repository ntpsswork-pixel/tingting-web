/* TTGPlus Session Guard (Multi-Tab Safe)
--------------------------------------
คุณสมบัติ:
- 1 Browser = 1 sessionId
- เปิดหลาย tab ได้ (ใช้ session เดียวกันจาก localStorage)
- ถ้ามี login จากเครื่องอื่น → tab เดิมโดนเตะ
- heartbeat อัปเดต lastActive

วิธีใช้:

1. ใส่ใน home.html
<script src="ttg_session_guard.js"></script>

2. หลัง login สำเร็จ
await TTGSession.register(currentUser.username)

3. ตอนเข้า dashboard / home
TTGSession.startGuard(currentUser.username)

4. ตอน logout
TTGSession.logout()
*/

window.TTGSession = (function(){

    const SESSION_KEY = "ttg_sessionId";

    let _username = null;
    let _interval = null;

    function _generateSession(){
        return Date.now()+"_"+Math.random().toString(36).slice(2,8);
    }

    function _getSession(){
        let s = localStorage.getItem(SESSION_KEY);
        if(!s){
            s = _generateSession();
            localStorage.setItem(SESSION_KEY,s);
        }
        return s;
    }

    async function register(username){

        _username = username;

        const sessionId = _getSession();

        await setDoc(doc(db,'activeSessions',username),{
            sessionId:sessionId,
            lastActive:Date.now(),
            device:navigator.userAgent
        });

        return sessionId;
    }

    function startGuard(username){

        _username = username;

        const localSession = _getSession();

        if(_interval) clearInterval(_interval);

        _interval = setInterval(async ()=>{

            try{

                const snap = await getDoc(doc(db,'activeSessions',_username));

                if(!snap.exists()) return;

                const serverSession = snap.data().sessionId;

                if(serverSession !== localSession){

                    alert("⚠️ บัญชีนี้ถูก login จากอุปกรณ์อื่น");

                    localStorage.removeItem(SESSION_KEY);

                    location.href='login.html';

                } else {

                    updateDoc(
                        doc(db,'activeSessions',_username),
                        { lastActive:Date.now() }
                    );

                }

            }
            catch(e){
                console.error("Session check error",e);
            }

        },30000);

    }

    function logout(){

        localStorage.removeItem(SESSION_KEY);

        if(_interval) clearInterval(_interval);

        location.href='login.html';

    }

    return {
        register,
        startGuard,
        logout
    };

})();