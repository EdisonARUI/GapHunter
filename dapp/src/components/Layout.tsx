import { ConnectButton } from "@mysten/dapp-kit";
import { Container, Heading } from "@radix-ui/themes";
import { useState, useEffect, useRef } from "react";
import Sidebar from "./Sidebar";
import { Menu } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { Text } from '@radix-ui/themes';
import PriceAlertListener from './PriceAlertListener';

interface LayoutProps {
  children?: React.ReactNode;
}

// 全局样式对象
const globalStyles = {
  body: {
    margin: 0,
    padding: 0,
    backgroundColor: '#121212',
    color: '#FFFFFF'
  },
  contentContainer: {
    backgroundColor: '#121212'
  },
  contentInner: {
    backgroundColor: '#121212'
  }
};

export default function Layout({ children }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [titleWidth, setTitleWidth] = useState(160); // 默认标题宽度估计值
  const titleRef = useRef<HTMLDivElement>(null);
  const currentAccount = useCurrentAccount();
  const [isMobile, setIsMobile] = useState(false);

  // 检测是否为移动设备
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768); // 小于768px视为移动设备
    };
    
    // 初始检测
    checkIfMobile();
    
    // 监听窗口大小变化
    window.addEventListener('resize', checkIfMobile);
    
    // 清理函数
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  // 测量标题宽度
  useEffect(() => {
    if (titleRef.current) {
      const width = titleRef.current.getBoundingClientRect().width;
      // 增加一点额外空间，使其看起来更平衡
      setTitleWidth(Math.ceil(width) + 20);
    }
  }, []);

  // 添加全局样式
  useEffect(() => {
    // 应用全局样式到body
    Object.assign(document.body.style, globalStyles.body);
    
    // 查找并应用样式到内容容器
    const contentContainers = document.querySelectorAll('.rt-Container');
    contentContainers.forEach(container => {
      Object.assign((container as HTMLElement).style, globalStyles.contentContainer);
      
      // 应用样式到内容容器的子元素
      container.childNodes.forEach(child => {
        if (child instanceof HTMLElement) {
          Object.assign(child.style, globalStyles.contentInner);
        }
      });
    });
    
    // 清理函数
    return () => {
      // 恢复body样式
      document.body.style.backgroundColor = '';
      document.body.style.color = '';
      document.body.style.margin = '';
      document.body.style.padding = '';
    };
  }, []);

  const handleMenuClick = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };
  
  // 计算侧边栏宽度 = 菜单按钮宽度(72px) + GapHunter标题宽度
  const sidebarWidth = 72 + titleWidth;

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      minHeight: '100vh',
      backgroundColor: '#0F0F0F', 
      color: '#FFFFFF'
    }}>
      {/* Header */}
      <header style={{ 
        height: '64px', 
        backgroundColor: '#2563eb',
        display: 'flex', 
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0',
        borderBottom: '1px solid #2563eb',
        width: '100%',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', height: '100%', position: 'relative' }}>
          <div 
            style={{ 
              width: isSidebarOpen ? `${sidebarWidth}px` : '72px',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              transition: 'width 0.3s ease',
              position: 'relative'
            }}
          >
            <button 
              onClick={handleMenuClick}
              style={{ 
                width: '72px',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                border: 'none',
                backgroundColor: 'transparent',
              }}
            >
              <Menu size={20} color="white" />
            </button>
          </div>
          {/* 固定位置的标题 */}
          <div ref={titleRef} style={{
            position: 'absolute',
            left: '72px'
          }}>
            <Heading size="4" style={{ 
              color: 'white'
            }}>GapHunter</Heading>
          </div>
        </div>
        <div style={{ paddingRight: '24px' }}>
          <ConnectButton />
        </div>
      </header>

      {/* Main Content */}
      <div style={{ 
        display: 'flex', 
        flex: 1,
        flexDirection: isMobile ? 'column' : 'row',
        marginTop: '64px' // 为固定header留出空间
      }}>
        {/* Sidebar */}
        <nav style={{
          width: isMobile ? '100%' : (isSidebarOpen ? `${sidebarWidth}px` : '72px'),
          backgroundColor: '#1A1A1A',
          padding: '16px',
          transition: 'width 0.3s ease'
        }}>
          <Sidebar isOpen={isSidebarOpen} />
        </nav>

        {/* Main Content Area */}
        <main style={{ 
          flex: 1, 
          padding: '24px 16px',
          backgroundColor: '#121212'
        }}>
          {currentAccount && <PriceAlertListener />}
          <Outlet />
        </main>
      </div>

      {/* Footer */}
      <footer style={{
        backgroundColor: '#1A1A1A',
        padding: '16px',
        textAlign: 'center',
        color: '#94A3B8',
        fontSize: '14px'
      }}>
        <Container>
          <Text>GapHunter &copy; 2023 - Keeping an eye on cross-chain price gaps</Text>
        </Container>
      </footer>
    </div>
  );
} 