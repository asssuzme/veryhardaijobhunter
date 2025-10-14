import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, ExternalLink, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Vapi from '@vapi-ai/web';

interface VapiConfigHelperProps {
  onSuccess: (publicKey: string) => void;
  assistantId: string;
}

export function VapiConfigHelper({ onSuccess, assistantId }: VapiConfigHelperProps) {
  const [publicKey, setPublicKey] = useState('');
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [errorDetails, setErrorDetails] = useState('');
  
  const currentOrigin = window.location.origin;
  
  const testPublicKey = async () => {
    if (!publicKey.trim()) {
      setErrorDetails('Please enter a public key');
      setTestResult('error');
      return;
    }
    
    setIsTestingKey(true);
    setTestResult(null);
    setErrorDetails('');
    
    try {
      console.log('Testing Vapi public key:', publicKey);
      
      // Initialize Vapi with the provided key
      const vapi = new Vapi(publicKey.trim());
      
      // Set up event listeners to catch errors
      let testTimeout: NodeJS.Timeout;
      let hasConnected = false;
      
      const handleSuccess = () => {
        hasConnected = true;
        clearTimeout(testTimeout);
        setTestResult('success');
        setIsTestingKey(false);
        
        // Store the working key in localStorage
        localStorage.setItem('vapi_public_key', publicKey.trim());
        
        // Clean up
        vapi.stop();
        
        // Call success callback
        onSuccess(publicKey.trim());
      };
      
      const handleError = (error: any) => {
        console.error('Vapi test error:', error);
        clearTimeout(testTimeout);
        
        let errorMsg = 'Connection failed. ';
        
        if (error?.message?.includes('origin')) {
          errorMsg += `Make sure to add "${currentOrigin}" to allowed origins in your Vapi dashboard.`;
        } else if (error?.message) {
          errorMsg += error.message;
        } else {
          errorMsg += 'Please check your public key and try again.';
        }
        
        setErrorDetails(errorMsg);
        setTestResult('error');
        setIsTestingKey(false);
        
        // Clean up
        vapi.stop();
      };
      
      vapi.on('call-start', handleSuccess);
      vapi.on('error', handleError);
      
      // Set a timeout for the test
      testTimeout = setTimeout(() => {
        if (!hasConnected) {
          handleError({ message: 'Connection timeout. Please check your key and network connection.' });
        }
      }, 10000);
      
      // Try to start with the assistant
      console.log('Starting test call with assistant:', assistantId);
      await vapi.start(assistantId);
      
    } catch (error: any) {
      console.error('Error testing Vapi key:', error);
      setErrorDetails(error?.message || 'Failed to test public key');
      setTestResult('error');
      setIsTestingKey(false);
    }
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };
  
  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Configure Vapi Public Key</h3>
        <p className="text-sm text-gray-600 mb-4">
          To use voice interviews, you need to configure your Vapi public key with the correct origins.
        </p>
      </div>
      
      <Alert>
        <AlertDescription>
          <div className="space-y-2">
            <p className="font-semibold">Setup Instructions:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>
                Go to{' '}
                <a 
                  href="https://dashboard.vapi.ai/org/api-keys" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline inline-flex items-center gap-1"
                >
                  Vapi Dashboard - API Keys
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Create a new public key or use an existing one</li>
              <li>
                Add this origin to "Allowed Origins":
                <div className="flex items-center gap-2 mt-1">
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs">{currentOrigin}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(currentOrigin)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </li>
              <li>Copy your public key and paste it below</li>
            </ol>
          </div>
        </AlertDescription>
      </Alert>
      
      <div className="space-y-2">
        <label className="text-sm font-medium">Vapi Public Key</label>
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Enter your Vapi public key"
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
            className="flex-1"
          />
          <Button 
            onClick={testPublicKey}
            disabled={isTestingKey}
          >
            {isTestingKey ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Testing...
              </>
            ) : (
              'Test Key'
            )}
          </Button>
        </div>
      </div>
      
      {testResult === 'success' && (
        <Alert className="border-green-500 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <AlertDescription>
            <span className="text-green-700">
              Success! Your Vapi public key is configured correctly.
            </span>
          </AlertDescription>
        </Alert>
      )}
      
      {testResult === 'error' && (
        <Alert className="border-red-500 bg-red-50">
          <XCircle className="h-4 w-4 text-red-500" />
          <AlertDescription>
            <span className="text-red-700">
              {errorDetails}
            </span>
          </AlertDescription>
        </Alert>
      )}
      
      <Alert>
        <AlertDescription className="text-xs">
          <strong>Note:</strong> If you're still having issues, make sure:
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Your Vapi account has sufficient credits</li>
            <li>The assistant ID is correct: <code className="bg-gray-100 px-1">{assistantId}</code></li>
            <li>Your browser allows microphone access</li>
          </ul>
        </AlertDescription>
      </Alert>
    </Card>
  );
}