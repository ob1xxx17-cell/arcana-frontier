// server/tunnel.js - เซิร์ฟเวอร์พร้อมแชร์ลิงก์ให้เพื่อนเล่นออนไลน์
const { spawn } = require('child_process');
const os = require('os');

console.log('====================================================');
console.log('  🌐 กำลังเริ่มเซิร์ฟเวอร์ Arcana Frontier Online...');
console.log('====================================================');

// 1. รันเซิร์ฟเวอร์หลักใน Process เดียวกันทันที
require('./server.js');

// หา Local IP (Wi-Fi) ของเครื่องคอมพิวเตอร์
function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const localIp = getLocalIp();

console.log('\n====================================================');
console.log('  📱 วิธีที่ 1: เล่นในบ้าน (คอม + มือถือ ต่อ Wi-Fi เดียวกัน) [แนะนำ เร็วสุด 100%]');
console.log(`  👉  http://${localIp}:3000  👈`);
console.log('  *(เปิดใน Chrome มือถือได้ทันที ไม่ต้องใส่รหัส ภาพโหลดไวระดับเสี้ยววินาที)*');
console.log('====================================================');

// 2. สร้าง Public Tunnel ชี้ตรงไปที่ 127.0.0.1:3000 สำหรับเล่นกับเพื่อนข้ามอินเทอร์เน็ต
setTimeout(() => {
  console.log('\n🚀 กำลังสร้างลิงก์สำหรับส่งให้เพื่อนผ่านอินเทอร์เน็ต (วิธีที่ 2)...');
  const lt = spawn('cmd.exe', ['/c', 'npx', '--yes', 'localtunnel', '--port', '3000', '--local-host', '127.0.0.1']);

  let urlShown = false;
  lt.stdout.on('data', (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.loca\.lt/);
    if (match && !urlShown) {
      urlShown = true;
      const publicUrl = match[0];
      console.log('\n====================================================');
      console.log('  🌐 วิธีที่ 2: ลิงก์ออนไลน์สำหรับส่งให้เพื่อนเล่นข้ามเน็ต:');
      console.log(`  👉  ${publicUrl}  👈`);
      console.log('====================================================');
      console.log('📌 คำแนะนำสำคัญ:');
      console.log('  1. แนะนำให้เปิดด้วย Google Chrome หรือ Safari โดยตรง (หลีกเลี่ยงเบราว์เซอร์ใน Messenger/Line)');
      console.log('  2. หากเปิดแล้วเจอหน้าสีขาวถาม IP ให้ใส่เลข IP ที่แสดงบนหน้าเว็บ แล้วกดปุ่ม "Continue"');
      console.log('  3. กด "เริ่มเกม ออนไลน์" -> "สร้างห้องใหม่" นำรหัส 5 ตัวส่งให้เพื่อนใส่เพื่อดวลกัน');
      console.log('====================================================\n');
    }
  });

  lt.stderr.on('data', () => {});

  lt.on('close', (code) => {
    console.log('[TUNNEL] Tunnel closed with code:', code);
  });
}, 1000);
