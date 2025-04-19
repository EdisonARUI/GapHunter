import { useCurrentAccount } from "@mysten/dapp-kit";
import { Container, Heading } from "@radix-ui/themes";
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Layout from "./components/Layout";
import CreateTask from "./pages/CreateTask";
import TestPage from "./pages/TestPage";
import SimpleLayout from "./pages/SimpleLayout";
import PriceMonitor from "./pages/PriceMonitor";

function App() {
  const currentAccount = useCurrentAccount();

  return (
    <Router>
      <Routes>
        <Route path="/test" element={<TestPage />} />
        <Route path="/simple" element={<SimpleLayout />} />
        <Route path="*" element={
          <Layout>
            {currentAccount ? (
              <Routes>
                <Route path="/create-task" element={<CreateTask />} />
                <Route path="/monitor" element={<PriceMonitor />} />
                <Route path="/history" element={
                  <Container>
                    <Heading size="6">History</Heading>
                    <p className="mt-4 text-gray-600">Coming Soon</p>
                  </Container>
                } />
                <Route path="/settings" element={
                  <Container>
                    <Heading size="6">Settings</Heading>
                    <p className="mt-4 text-gray-600">Coming Soon</p>
                  </Container>
                } />
                <Route path="/" element={<Navigate to="/create-task" replace />} />
              </Routes>
            ) : (
              <Container>
                <div className="text-center py-10">
                  <Heading size="6" className="mb-4">Welcome to GapHunter</Heading>
                  <p className="text-gray-600">Please connect your wallet to continue</p>
                </div>
              </Container>
            )}
          </Layout>
        } />
      </Routes>
    </Router>
  );
}

export default App;
