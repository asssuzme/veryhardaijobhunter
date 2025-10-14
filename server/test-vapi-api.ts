import { VapiClient } from '@vapi-ai/server-sdk';
import dotenv from 'dotenv';

dotenv.config();

async function testVapiAPI() {
  console.log('=== Testing Vapi API ===\n');
  
  const apiKey = process.env.VAPI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ VAPI_API_KEY not found in environment variables');
    return;
  }
  
  console.log('✅ VAPI_API_KEY found');
  console.log(`API Key (first 10 chars): ${apiKey.substring(0, 10)}...`);
  
  try {
    // Initialize Vapi client
    const vapi = new VapiClient({
      token: apiKey
    });
    
    console.log('\n📋 Testing: List Assistants');
    console.log('----------------------------');
    
    // Try to list assistants
    const assistantsList = await vapi.assistants.list();
    
    console.log('Response type:', typeof assistantsList);
    console.log('Response keys:', assistantsList ? Object.keys(assistantsList) : 'null');
    
    // Handle different response structures
    let assistants: any[] = [];
    
    if (Array.isArray(assistantsList)) {
      assistants = assistantsList;
      console.log(`✅ Found ${assistants.length} assistants (array response)`);
    } else if ((assistantsList as any)?.items) {
      assistants = (assistantsList as any).items;
      console.log(`✅ Found ${assistants.length} assistants (items property)`);
    } else if ((assistantsList as any)?.data) {
      assistants = (assistantsList as any).data;
      console.log(`✅ Found ${assistants.length} assistants (data property)`);
    } else {
      console.log('⚠️ Unknown response structure:', assistantsList);
    }
    
    // Display assistants
    if (assistants.length > 0) {
      console.log('\n📝 Assistants:');
      assistants.forEach((assistant: any, index: number) => {
        console.log(`\n${index + 1}. ${assistant.name || 'Unnamed'}`);
        console.log(`   ID: ${assistant.id}`);
        console.log(`   Model: ${assistant.model?.provider}/${assistant.model?.model}`);
        console.log(`   Voice: ${assistant.voice?.provider}/${assistant.voice?.voiceId}`);
        if (assistant.firstMessage) {
          console.log(`   First Message: "${assistant.firstMessage.substring(0, 50)}..."`);
        }
      });
    } else {
      console.log('\n⚠️ No assistants found');
    }
    
    // Try to get a specific assistant if we have the ID
    const testAssistantId = '86969d3b-28ef-4967-9841-3919f448c64c';
    console.log(`\n🔍 Testing: Get specific assistant (${testAssistantId})`);
    console.log('----------------------------');
    
    try {
      const assistant = await vapi.assistants.get(testAssistantId);
      console.log('✅ Assistant found!');
      console.log('   Name:', assistant.name);
      console.log('   ID:', assistant.id);
    } catch (error: any) {
      console.log('❌ Could not get assistant:', error.message || error);
    }
    
    // Test creating a simple assistant
    console.log('\n🏗️ Testing: Create new assistant');
    console.log('----------------------------');
    
    try {
      const newAssistant = await vapi.assistants.create({
        name: "Test Assistant - Delete Me",
        model: {
          provider: "openai" as const,
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system" as const,
              content: "You are a test assistant. Just say hello."
            }
          ]
        },
        voice: {
          provider: "11labs" as const,
          voiceId: "21m00Tcm4TlvDq8ikWAM"
        },
        firstMessage: "Hello, this is a test.",
        transcriber: {
          provider: "deepgram" as const,
          model: "nova-2",
          language: "en"
        }
      });
      
      console.log('✅ Assistant created successfully!');
      console.log('   ID:', newAssistant.id);
      console.log('   Name:', newAssistant.name);
      
      // Clean up - delete the test assistant
      console.log('\n🗑️ Cleaning up test assistant...');
      await vapi.assistants.delete(newAssistant.id);
      console.log('✅ Test assistant deleted');
      
    } catch (error: any) {
      console.log('❌ Could not create assistant:', error.message || error);
      if (error.response) {
        console.log('Response details:', JSON.stringify(error.response, null, 2));
      }
    }
    
    console.log('\n✅ API test completed successfully!');
    
  } catch (error: any) {
    console.error('\n❌ API test failed:', error.message || error);
    if (error.response) {
      console.error('Response details:', JSON.stringify(error.response, null, 2));
    }
    console.error('Full error:', error);
  }
}

// Run the test
testVapiAPI().catch(console.error);