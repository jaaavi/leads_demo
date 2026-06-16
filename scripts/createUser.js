#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const readline = require('readline');
const { createUsersTable, createUser } = require('../models/userModel');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('\n=== Crear nuevo usuario ===\n');

  try {
    // Crear tabla si no existe
    console.log('Verificando tabla de usuarios...');
    await createUsersTable();
    console.log('✓ Tabla de usuarios lista\n');

    // Pedir datos
    const username = await question('Username: ');
    if (!username.trim()) {
      console.error('❌ Error: Username no puede estar vacío');
      process.exit(1);
    }

    const email = await question('Email: ');
    if (!email.trim()) {
      console.error('❌ Error: Email no puede estar vacío');
      process.exit(1);
    }

    const password = await question('Password: ');
    if (!password.trim()) {
      console.error('❌ Error: Password no puede estar vacío');
      process.exit(1);
    }

    // Crear usuario
    console.log('\nCreando usuario...');
    const user = await createUser(username.trim(), email.trim(), password);
    console.log('✓ Usuario creado exitosamente!');
    console.log(`  ID: ${user.id}`);
    console.log(`  Username: ${user.username}`);
    console.log(`  Email: ${user.email}\n`);
    
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error.message}\n`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
