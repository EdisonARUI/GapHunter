import * as Dialog from '@radix-ui/react-dialog';

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string;
  operation: string;
}

// 定义可重用样式
const styles = {
  monospaceText: {
    fontFamily: 'monospace',
    wordBreak: 'break-word' as const,
  },
  buttonPrimary: {
    backgroundColor: '#3B82F6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
};

export function TransactionDialog({ open, onOpenChange, transactionId, operation }: TransactionDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          position: 'fixed',
          inset: 0,
          animation: 'overlayShow 150ms cubic-bezier(0.16, 1, 0.3, 1)'
        }} />
        <Dialog.Content style={{
          backgroundColor: '#1A1A1A',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90vw',
          maxWidth: '450px',
          maxHeight: '85vh',
          padding: '24px',
          animation: 'contentShow 150ms cubic-bezier(0.16, 1, 0.3, 1)',
          border: '1px solid #333',
          color: '#FFFFFF'
        }}>
          <Dialog.Title style={{ margin: 0, fontWeight: 'bold', fontSize: '18px', display: 'flex', alignItems: 'center' }}>
            <div style={{ 
              backgroundColor: 'rgba(34, 197, 94, 0.2)', 
              color: '#22c55e',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '12px'
            }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 10L9 12L13 8" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            {operation || '操作'}成功
          </Dialog.Title>
          <Dialog.Description style={{ marginTop: '16px', fontSize: '14px', color: '#94A3B8' }}>
            您的交易已成功提交到区块链
          </Dialog.Description>
          
          <div style={{ margin: '20px 0', padding: '12px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>交易ID:</div>
            <div style={styles.monospaceText}>
              {transactionId}
            </div>
          </div>
          
          <div style={{ display: 'flex', marginTop: '24px', justifyContent: 'flex-end' }}>
            <button 
              onClick={() => onOpenChange(false)}
              style={styles.buttonPrimary}
            >
              确定
            </button>
          </div>
          
          <Dialog.Close asChild>
            <button
              style={{
                fontFamily: 'inherit',
                borderRadius: '100%',
                height: '25px',
                width: '25px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94A3B8',
                position: 'absolute',
                top: '16px',
                right: '16px',
                cursor: 'pointer',
                backgroundColor: 'transparent',
                border: 'none'
              }}
              aria-label="Close"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
              </svg>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
} 