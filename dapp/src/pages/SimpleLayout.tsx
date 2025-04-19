import { ConnectButton } from "@mysten/dapp-kit";
import { Container, Heading } from "@radix-ui/themes";
import { useState } from "react";
import { Menu } from 'lucide-react';

export default function SimpleLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleMenuClick = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <div 
        style={{ 
          width: isSidebarOpen ? '240px' : '72px',
          backgroundColor: '#ffffff',
          borderRight: '1px solid #e5e7eb',
          transition: 'width 0.3s ease'
        }}
      >
        <div style={{ 
          height: '64px', 
          display: 'flex', 
          alignItems: 'center', 
          padding: '0 16px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          {isSidebarOpen ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <Heading size="4">GapHunter</Heading>
              <button onClick={handleMenuClick}>
                <Menu size={20} />
              </button>
            </div>
          ) : (
            <button onClick={handleMenuClick} style={{ margin: '0 auto' }}>
              <Menu size={20} />
            </button>
          )}
        </div>
        <nav>
          <ul style={{ listStyle: 'none', padding: '8px 0' }}>
            <li style={{ 
              padding: '12px 16px',
              backgroundColor: '#eff6ff',
              color: '#2563eb'
            }}>
              Dashboard
            </li>
            <li style={{ padding: '12px 16px' }}>Settings</li>
          </ul>
        </nav>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1 }}>
        {/* Header */}
        <header style={{ 
          height: '64px', 
          backgroundColor: '#2563eb',
          display: 'flex', 
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 24px'
        }}>
          <ConnectButton />
        </header>

        {/* Content */}
        <main style={{ padding: '24px' }}>
          <Container>
            <Heading>Simple Layout Test Page</Heading>
            <p style={{ marginTop: '16px' }}>
              This is a simple layout page for testing purposes.
            </p>
          </Container>
        </main>
      </div>
    </div>
  );
} 