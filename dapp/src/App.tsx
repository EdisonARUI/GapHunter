import { useCurrentAccount } from "@mysten/dapp-kit";
import { Container, Heading } from "@radix-ui/themes";
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Layout from "./components/Layout";
import CreateTask from "./pages/CreateTask";
import PriceMonitor from "./pages/PriceMonitor";
import History from "./pages/History";
import { Liquidity } from "./pages/Liquidity";

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
