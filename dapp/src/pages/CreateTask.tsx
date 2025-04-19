import { useState } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { Container, Heading } from '@radix-ui/themes';
import TaskForm from '../components/TaskForm';
import { TaskConfig } from '../types/task';

export default function CreateTask() {
  const currentAccount = useCurrentAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (task: Omit<TaskConfig, 'id' | 'last_alert'>) => {
    try {
      setIsLoading(true);
      setError(null);

      // TODO: Call smart contract to create task
      console.log('Creating task:', task);
      
      // Simulate task creation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      alert('Task created successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container style={{ backgroundColor: '#121212' }}>
      <div style={{ maxWidth: '672px', margin: '0 auto', backgroundColor: '#121212' }}>
        {!currentAccount && (
          <div style={{ 
            backgroundColor: 'rgba(146, 64, 14, 0.2)', 
            borderLeftWidth: '4px', 
            borderLeftColor: '#ca8a04', 
            padding: '16px', 
            marginBottom: '16px', 
            borderRadius: '4px' 
          }}>
            <div style={{ display: 'flex' }}>
              <div style={{ flexShrink: 0 }}>
                <svg style={{ height: '20px', width: '20px', color: '#ca8a04' }} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div style={{ marginLeft: '12px' }}>
                <p style={{ fontSize: '14px', color: '#ca8a04' }}>
                  Please connect your wallet to create a task
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div style={{ 
            backgroundColor: 'rgba(127, 29, 29, 0.2)', 
            borderLeftWidth: '4px', 
            borderLeftColor: '#dc2626', 
            padding: '16px', 
            marginBottom: '16px', 
            borderRadius: '4px' 
          }}>
            <div style={{ display: 'flex' }}>
              <div style={{ flexShrink: 0 }}>
                <svg style={{ height: '20px', width: '20px', color: '#dc2626' }} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div style={{ marginLeft: '12px' }}>
                <p style={{ fontSize: '14px', color: '#dc2626' }}>
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        <div style={{ backgroundColor: '#121212' }}>
          <TaskForm onSubmit={handleSubmit} />
        </div>

        {isLoading && (
          <div style={{ marginTop: '16px', textAlign: 'center', backgroundColor: '#121212' }}>
            <div style={{ 
              display: 'inline-block', 
              animation: 'spin 1s linear infinite',
              borderRadius: '9999px',
              height: '32px',
              width: '32px',
              borderWidth: '4px',
              borderColor: '#3b82f6',
              borderTopColor: 'transparent'
            }}></div>
            <p style={{ marginTop: '8px', fontSize: '14px', color: '#9ca3af' }}>Creating task...</p>
          </div>
        )}
      </div>
    </Container>
  );
} 