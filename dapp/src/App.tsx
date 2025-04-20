import { useCurrentAccount } from "@mysten/dapp-kit";
import { Container, Heading } from "@radix-ui/themes";
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Layout from "./components/Layout";
import CreateTask from "./pages/CreateTask";
import PriceMonitor from "./pages/PriceMonitor";
import History from "./pages/History";
import { Liquidity } from "./pages/Liquidity";
import PriceAlertListener from "./components/PriceAlertListener";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={
            <RequireWallet>
              <Navigate to="/create-task" replace />
            </RequireWallet>
          } />
          <Route path="create-task" element={
            <RequireWallet>
              <CreateTask />
            </RequireWallet>
          } />
          <Route path="monitor" element={
            <RequireWallet>
              <PriceMonitor />
            </RequireWallet>
          } />
          <Route path="history" element={
            <RequireWallet>
              <History />
            </RequireWallet>
          } />
          <Route path="liquidity" element={
            <RequireWallet>
              <Liquidity />
            </RequireWallet>
          } />
          <Route path="settings" element={
            <RequireWallet>
              <Container>
                <Heading size="6">Settings</Heading>
                <p className="mt-4 text-gray-600">Coming Soon</p>
              </Container>
            </RequireWallet>
          } />
          <Route path="auto-arbitrage" element={
            <RequireWallet>
              <Container>
                <Heading size="6">自动套利系统</Heading>
                <div className="mt-4">
                  <PriceAlertListener />
                </div>
                <div className="mt-8">
                  <p>自动套利系统将监控价格异常事件，并自动执行以下操作：</p>
                  <ol className="list-decimal ml-6 mt-2">
                    <li>解质押所有质押的gUSDT</li>
                    <li>执行跨链套利操作（目前由mint模拟）</li>
                    <li>将所有资金（包括套利获得的收益）重新质押</li>
                  </ol>
                </div>
              </Container>
            </RequireWallet>
          } />
        </Route>
      </Routes>
    </Router>
  );
}

// 钱包连接检查组件
function RequireWallet({ children }: { children: React.ReactNode }) {
  const currentAccount = useCurrentAccount();
  
  if (!currentAccount) {
    return (
      <Container>
        <div className="text-center py-10">
          <Heading size="6" className="mb-4">Welcome to GapHunter</Heading>
          <p className="text-gray-600">Please connect your wallet to continue</p>
        </div>
      </Container>
    );
  }

  return <>{children}</>;
}

export default App;
