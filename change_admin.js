const crypto = require('crypto');
const { run, get, all } = require('./db');

async function main() {
  const args = process.argv.slice(2);

  console.log('========================================================');
  console.log('       UniPrep - Công Cụ Quản Lý Tài Khoản Quản Trị     ');
  console.log('========================================================\n');

  const users = await all('SELECT id, username, display_name, created_at FROM admin_users');
  console.log('Danh sách tài khoản Admin hiện có trong cơ sở dữ liệu:');
  if (users.length === 0) {
    console.log('  (Chưa có tài khoản nào)');
  } else {
    users.forEach(u => console.log(`  - ID: ${u.id} | Username: "${u.username}" | Tên hiển thị: "${u.display_name}"`));
  }
  console.log('');

  if (args.length < 2) {
    console.log('👉 Hướng dẫn sử dụng cú pháp:');
    console.log('   node change_admin.js <tên_đăng_nhập_mới> <mật_khẩu_mới> [tên_hiển_thị]');
    console.log('\nVí dụ mẫu:');
    console.log('   node change_admin.js admin 123456');
    console.log('   node change_admin.js quanly MatKhauBaoMat@2026 "Trưởng Ban Đề Thi"\n');
    process.exit(0);
  }

  const newUsername = args[0].trim();
  const newPassword = args[1];
  const newDisplayName = args[2] ? args[2].trim() : (newUsername === 'admin' ? 'Quản Trị Viên' : newUsername);

  if (!newUsername || !newPassword) {
    console.error('❌ Lỗi: Tên đăng nhập và mật khẩu không được để trống.');
    process.exit(1);
  }

  if (newPassword.length < 4) {
    console.error('❌ Lỗi: Mật khẩu phải có độ dài từ 4 ký tự trở lên.');
    process.exit(1);
  }

  const hash = crypto.createHash('sha256').update(newPassword).digest('hex');

  const targetUser = users[0];
  if (!targetUser) {
    await run(
      'INSERT INTO admin_users (username, password_hash, display_name) VALUES (?, ?, ?)',
      [newUsername, hash, newDisplayName]
    );
    console.log(`✅ Đã tạo tài khoản quản trị mới thành công!`);
  } else {
    await run(
      'UPDATE admin_users SET username = ?, password_hash = ?, display_name = ? WHERE id = ?',
      [newUsername, hash, newDisplayName, targetUser.id]
    );
    console.log(`✅ Đã cập nhật tài khoản quản trị ID #${targetUser.id} thành công!`);
  }

  console.log(`--------------------------------------------------------`);
  console.log(`  👤 Tên đăng nhập mới : ${newUsername}`);
  console.log(`  🔑 Mật khẩu mới      : ${newPassword}`);
  console.log(`  🏷️  Tên hiển thị      : ${newDisplayName}`);
  console.log(`--------------------------------------------------------`);
  console.log(`Bây giờ bạn có thể đăng nhập vào trang Quản trị tại http://localhost:3000 với thông tin trên.\n`);
  process.exit(0);
}

main().catch(err => {
  console.error('Lỗi khi cập nhật tài khoản:', err);
  process.exit(1);
});

