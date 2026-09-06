<?php
// Run this once with `php generate_hash.php` to get a real bcrypt hash
// for the seed accounts in schema.sql (all demo accounts use "password123").
echo password_hash('password123', PASSWORD_BCRYPT) . PHP_EOL;
