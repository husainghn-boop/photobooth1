#!/usr/bin/env node

/**
 * Supabase Database Audit Script
 * Run with: node scripts/audit-db.mjs
 * Requires: npm install dotenv
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.join(__dirname, '..')
const envPath = path.join(projectRoot, '.env.local')

let envVars = {}
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=')
    if (key && value) {
      envVars[key.trim()] = value.trim()
    }
  })
}

const VITE_SUPABASE_URL = envVars.VITE_SUPABASE_URL
const VITE_SUPABASE_PUBLISHABLE_KEY = envVars.VITE_SUPABASE_PUBLISHABLE_KEY

if (!VITE_SUPABASE_URL || !VITE_SUPABASE_PUBLISHABLE_KEY) {
  console.error('❌ Missing Supabase environment variables in .env.local')
  console.error('   VITE_SUPABASE_URL:', VITE_SUPABASE_URL ? '✓' : '✗')
  console.error('   VITE_SUPABASE_PUBLISHABLE_KEY:', VITE_SUPABASE_PUBLISHABLE_KEY ? '✓' : '✗')
  process.exit(1)
}

// Lazy load supabase-js to avoid errors if not installed
let createClient
try {
  const supabaseJs = await import('@supabase/supabase-js')
  createClient = supabaseJs.createClient
} catch (err) {
  console.error('❌ Error loading @supabase/supabase-js')
  console.error('   Run: npm install @supabase/supabase-js')
  process.exit(1)
}

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)

async function auditDatabase() {
  console.log('\n╔════════════════════════════════════════╗')
  console.log('║  SUPABASE DATABASE READ-ONLY AUDIT     ║')
  console.log('╚════════════════════════════════════════╝\n')

  try {
    // 1. Query all frames
    console.log('📋 1. FRAMES TABLE')
    console.log('─'.repeat(60))
    const { data: framesData, error: framesError } = await supabase
      .from('frames')
      .select('*')
      .order('created_at', { ascending: true })

    if (framesError) {
      console.error('❌ ERROR:', framesError.message)
      return
    }

    if (!framesData || framesData.length === 0) {
      console.log('⚠️  No frames found in database\n')
    } else {
      console.log(`✓ Found ${framesData.length} frame(s)\n`)
      framesData.forEach((frame, idx) => {
        console.log(`Frame ${idx + 1}:`)
        console.log(`  ID:              ${frame.id}`)
        console.log(`  Name:            ${frame.name}`)
        console.log(`  Type:            ${frame.type} ${frame.type === 'official' ? '(⭐ Official)' : '(👥 Community)'}`)
        console.log(`  Photo Count:     ${frame.photo_count}`)
        console.log(`  Owner ID:        ${frame.owner_id || '(none - official)'}`)
        console.log(`  Description:     ${frame.description || '(none)'}`)
        console.log(`  Layout Type:     ${frame.layout_type}`)
        console.log(`  Preview Path:    ${frame.preview_path || '❌ MISSING'}`)
        console.log(`  Overlay Path:    ${frame.overlay_path || '❌ MISSING'}`)
        console.log(`  Public:          ${frame.is_public ? '✓' : '✗'}`)
        console.log(`  Active:          ${frame.is_active ? '✓' : '✗'}`)
        console.log(`  Created:         ${new Date(frame.created_at).toISOString()}`)
        console.log()
      })
    }

    // 2. Query frame_slots for each frame
    console.log('📌 2. FRAME_SLOTS TABLE')
    console.log('─'.repeat(60))
    const { data: slotsData, error: slotsError } = await supabase
      .from('frame_slots')
      .select('*')
      .order('frame_id', { ascending: true })
      .order('slot_order', { ascending: true })

    if (slotsError) {
      console.error('❌ ERROR:', slotsError.message)
      return
    }

    if (!slotsData || slotsData.length === 0) {
      console.log('⚠️  No frame_slots found\n')
    } else {
      console.log(`✓ Found ${slotsData.length} total slot(s)\n`)

      // Group by frame
      const slotsByFrame = {}
      slotsData.forEach(slot => {
        if (!slotsByFrame[slot.frame_id]) slotsByFrame[slot.frame_id] = []
        slotsByFrame[slot.frame_id].push(slot)
      })

      framesData?.forEach(frame => {
        const slots = slotsByFrame[frame.id] || []
        console.log(`Frame: ${frame.name} (ID: ${frame.id})`)
        console.log(`  Expected slots: ${frame.photo_count}`)
        console.log(`  Actual slots:   ${slots.length} ${slots.length === frame.photo_count ? '✓' : '❌'}`)
        
        if (slots.length > 0) {
          slots.forEach((slot, idx) => {
            console.log(`    Slot ${slot.slot_order}:`)
            console.log(`      Position: (${slot.x}, ${slot.y})`)
            console.log(`      Size:     ${slot.width} × ${slot.height}`)
            console.log(`      Rotation: ${slot.rotation}°`)
            console.log(`      Object Position: (${slot.object_position_x}, ${slot.object_position_y})`)
          })
        } else {
          console.log(`    ❌ No slots defined!`)
        }
        console.log()
      })
    }

    // 3. Query profiles
    console.log('👤 3. PROFILES TABLE')
    console.log('─'.repeat(60))
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')

    if (profilesError) {
      console.error('❌ ERROR:', profilesError.message)
      return
    }

    if (!profilesData || profilesData.length === 0) {
      console.log('⚠️  No profiles found\n')
    } else {
      console.log(`✓ Found ${profilesData.length} profile(s)\n`)
      profilesData.forEach(profile => {
        console.log(`Profile:`)
        console.log(`  ID:       ${profile.id}`)
        console.log(`  Name:     ${profile.display_name}`)
        console.log(`  Avatar:   ${profile.avatar_url || '(none)'}`)
        console.log()
      })
    }

    // 4. Check Storage
    console.log('💾 4. STORAGE BUCKETS')
    console.log('─'.repeat(60))
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()

    if (bucketsError) {
      console.error('❌ ERROR:', bucketsError.message)
    } else if (!buckets || buckets.length === 0) {
      console.log('⚠️  No storage buckets found\n')
    } else {
      console.log(`✓ Found ${buckets.length} bucket(s)\n`)
      buckets.forEach(bucket => {
        console.log(`  • ${bucket.name}`)
      })

      // Check 'frames' bucket
      const framesBucket = buckets.find(b => b.name === 'frames')
      if (framesBucket) {
        console.log('\n📁 Contents of "frames" bucket:')
        const { data: files, error: filesError } = await supabase.storage
          .from('frames')
          .list('', { limit: 100 })

        if (filesError) {
          console.error(`  ❌ Error: ${filesError.message}`)
        } else if (!files || files.length === 0) {
          console.log('  (empty - ⚠️  no frame assets uploaded)')
        } else {
          files.forEach(file => {
            if (file.name !== '.emptyFolderPlaceholder') {
              console.log(`    • ${file.name}`)
            }
          })
        }
      } else {
        console.log('\n⚠️  "frames" storage bucket not found')
      }
    }

    // 5. Test RLS
    console.log('\n🔐 5. RLS POLICY TEST')
    console.log('─'.repeat(60))
    console.log('Testing anonymous user access to public frames...')
    
    const anonClient = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)
    const { data: anonFrames, error: anonError } = await anonClient
      .from('frames')
      .select('id, name, type, is_public')

    if (anonError) {
      console.error(`  ❌ Error: ${anonError.message}`)
    } else if (!anonFrames || anonFrames.length === 0) {
      console.log(`  ⚠️  Anon users cannot see any frames`)
    } else {
      console.log(`  ✓ Anon users can see ${anonFrames.length} public frame(s)`)
      anonFrames.forEach(frame => {
        console.log(`    • ${frame.name} (${frame.type})`)
      })
    }

    // 6. Comparison with sampleFrames.ts
    console.log('\n🔍 6. COMPARISON WITH sampleFrames.ts')
    console.log('─'.repeat(60))
    
    const sampleFrameNames = ['Classic Strip', 'Double Portrait', 'Editorial', 'Four Grid']
    const dbFrameNames = (framesData || []).map(f => f.name)
    
    console.log('Expected frames from sampleFrames.ts:')
    sampleFrameNames.forEach(name => {
      const found = dbFrameNames.includes(name)
      console.log(`  ${found ? '✓' : '❌'} ${name}`)
    })

    const missing = sampleFrameNames.filter(name => !dbFrameNames.includes(name))
    if (missing.length > 0) {
      console.log(`\n⚠️  Missing frames: ${missing.join(', ')}`)
    } else {
      console.log('\n✓ All frames from sampleFrames.ts exist in database')
    }

    // Summary
    console.log('\n' + '═'.repeat(60))
    console.log('📊 SUMMARY')
    console.log('═'.repeat(60))
    console.log(`Total frames:          ${framesData?.length || 0}`)
    console.log(`Total slots:           ${slotsData?.length || 0}`)
    console.log(`Total profiles:        ${profilesData?.length || 0}`)
    console.log(`Storage buckets:       ${buckets?.length || 0}`)
    console.log(`Missing SVG overlays:  ${(framesData || []).filter(f => !f.overlay_path).length}`)
    console.log(`Missing previews:      ${(framesData || []).filter(f => !f.preview_path).length}`)
    console.log()
  } catch (error) {
    console.error('❌ UNEXPECTED ERROR:', error.message)
    process.exit(1)
  }
}

// Run audit
await auditDatabase()
