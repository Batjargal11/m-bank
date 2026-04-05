import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const AUTH_DB_URL = process.env.AUTH_DATABASE_URL || 'postgresql://mbank:mbank_dev@localhost:5432/auth_db';

async function seed() {
  const pool = new Pool({ connectionString: AUTH_DB_URL });

  try {
    console.log('Seeding database...');

    // Create organizations
    const orgA = await pool.query(
      `INSERT INTO organizations (org_id, name, registration_no, is_active)
       VALUES ('a0000000-0000-0000-0000-000000000001', 'Монгол Технологи ХХК', 'REG-001', true)
       ON CONFLICT (registration_no) DO NOTHING
       RETURNING org_id`
    );

    const orgB = await pool.query(
      `INSERT INTO organizations (org_id, name, registration_no, is_active)
       VALUES ('b0000000-0000-0000-0000-000000000002', 'Улаанбаатар Худалдаа ХХК', 'REG-002', true)
       ON CONFLICT (registration_no) DO NOTHING
       RETURNING org_id`
    );

    console.log('Organizations created');

    // Create accounts
    const accounts = [
      { account_id: 'ac000000-0000-0000-0000-000000000001', org_id: 'a0000000-0000-0000-0000-000000000001', account_no: '1001000001', currency: 'MNT' },
      { account_id: 'ac000000-0000-0000-0000-000000000002', org_id: 'a0000000-0000-0000-0000-000000000001', account_no: '1001000002', currency: 'USD' },
      { account_id: 'ac000000-0000-0000-0000-000000000003', org_id: 'b0000000-0000-0000-0000-000000000002', account_no: '2001000001', currency: 'MNT' },
      { account_id: 'ac000000-0000-0000-0000-000000000004', org_id: 'b0000000-0000-0000-0000-000000000002', account_no: '2001000002', currency: 'USD' },
    ];

    for (const acc of accounts) {
      await pool.query(
        `INSERT INTO accounts (account_id, org_id, account_no, currency, is_active)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (account_no) DO NOTHING`,
        [acc.account_id, acc.org_id, acc.account_no, acc.currency]
      );
    }
    console.log('Accounts created');

    // Create users
    const passwordHash = await bcrypt.hash('password123', 10);

    const users = [
      // Org A users
      { user_id: 'c0000000-0000-0000-0000-000000000001', org_id: 'a0000000-0000-0000-0000-000000000001', username: 'maker_a', email: 'maker@orgA.mn', full_name: 'Бат Болд', role: 'CORPORATE_MAKER' },
      { user_id: 'c0000000-0000-0000-0000-000000000002', org_id: 'a0000000-0000-0000-0000-000000000001', username: 'approver_a', email: 'approver@orgA.mn', full_name: 'Дорж Сүхбат', role: 'CORPORATE_APPROVER' },
      { user_id: 'c0000000-0000-0000-0000-000000000003', org_id: 'a0000000-0000-0000-0000-000000000001', username: 'user_a', email: 'user@orgA.mn', full_name: 'Оюунаа Бямба', role: 'CORPORATE_USER' },
      // Org B users
      { user_id: 'c0000000-0000-0000-0000-000000000004', org_id: 'b0000000-0000-0000-0000-000000000002', username: 'maker_b', email: 'maker@orgB.mn', full_name: 'Ганбаатар Эрдэнэ', role: 'CORPORATE_MAKER' },
      { user_id: 'c0000000-0000-0000-0000-000000000005', org_id: 'b0000000-0000-0000-0000-000000000002', username: 'approver_b', email: 'approver@orgB.mn', full_name: 'Мөнхбат Тэмүүлэн', role: 'CORPORATE_APPROVER' },
      { user_id: 'c0000000-0000-0000-0000-000000000006', org_id: 'b0000000-0000-0000-0000-000000000002', username: 'user_b', email: 'user@orgB.mn', full_name: 'Сарнай Энхтуяа', role: 'CORPORATE_USER' },
      // Admin
      { user_id: 'c0000000-0000-0000-0000-000000000007', org_id: 'a0000000-0000-0000-0000-000000000001', username: 'admin', email: 'admin@bank.mn', full_name: 'Систем Админ', role: 'SYSTEM_ADMIN' },
      // Bank operator
      { user_id: 'c0000000-0000-0000-0000-000000000008', org_id: 'a0000000-0000-0000-0000-000000000001', username: 'operator', email: 'operator@bank.mn', full_name: 'Банк Оператор', role: 'BANK_OPERATOR' },
    ];

    for (const user of users) {
      await pool.query(
        `INSERT INTO users (user_id, org_id, username, email, password_hash, full_name, role, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)
         ON CONFLICT (username) DO NOTHING`,
        [user.user_id, user.org_id, user.username, user.email, passwordHash, user.full_name, user.role]
      );
    }
    console.log('Users created');

    console.log('\n=== Seed Complete ===');
    console.log('Test accounts (password: password123):');
    console.log('  maker_a    - Org A, Corporate Maker');
    console.log('  approver_a - Org A, Corporate Approver');
    console.log('  user_a     - Org A, Corporate User');
    console.log('  maker_b    - Org B, Corporate Maker');
    console.log('  approver_b - Org B, Corporate Approver');
    console.log('  user_b     - Org B, Corporate User');
    console.log('  admin      - System Admin');
    console.log('  operator   - Bank Operator');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
