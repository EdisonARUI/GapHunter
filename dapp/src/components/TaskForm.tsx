import { useState, useEffect, useRef } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { TaskConfig } from '../types/task';

// 导入链图标
import ethereumIcon from '../asset/images/chain/ethereum.png';
import bnbIcon from '../asset/images/chain/bsc.png';
import polygonIcon from '../asset/images/chain/polygon.png';
import avalancheIcon from '../asset/images/chain/avalanche.png';
import solanaIcon from '../asset/images/chain/solana.png';
import suiIcon from '../asset/images/chain/sui.png';
import aptosIcon from '../asset/images/chain/aptos.png';
import baseIcon from '../asset/images/chain/base.png';
import optimismIcon from '../asset/images/chain/optimism.png';
import arbitrumIcon from '../asset/images/chain/arbitrum.png';

// 导入代币图标
import ethTokenIcon from '../asset/images/token/eth.png';
import bnbTokenIcon from '../asset/images/token/bnb.png';
import btcTokenIcon from '../asset/images/token/btc.png';
import solTokenIcon from '../asset/images/token/sol.png';
import maticTokenIcon from '../asset/images/token/matic.png';
import avaxTokenIcon from '../asset/images/token/avax.png';
import usdtTokenIcon from '../asset/images/token/usdt.png';
import usdcTokenIcon from '../asset/images/token/usdc.png';
import usdeTokenIcon from '../asset/images/token/usde.png';
import suiTokenIcon from '../asset/images/token/sui.png'; // SUI图标

interface TaskFormProps {
  onSubmit: (task: Omit<TaskConfig, 'id' | 'last_alert'>) => void;
}

export default function TaskForm({ onSubmit }: TaskFormProps) {
  const currentAccount = useCurrentAccount();
  const [chain1, setChain1] = useState<string>('ethereum');
  const [chain2, setChain2] = useState<string>('sui');
  const [token1, setToken1] = useState<string>('SUI');
  const [token2, setToken2] = useState<string>('USDT');
  const [threshold, setThreshold] = useState<number>(5);
  const [cooldown, setCooldown] = useState<number>(300);
  
  // 模拟下拉菜单的开关状态
  const [dropdownState, setDropdownState] = useState({
    chain1: false,
    chain2: false,
    token1: false,
    token2: false
  });

  // 创建下拉菜单的引用
  const chain1Ref = useRef<HTMLDivElement>(null);
  const chain2Ref = useRef<HTMLDivElement>(null);
  const token1Ref = useRef<HTMLDivElement>(null);
  const token2Ref = useRef<HTMLDivElement>(null);

  // 处理点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // 检查点击是否在各个下拉菜单之外
      if (chain1Ref.current && !chain1Ref.current.contains(event.target as Node) && dropdownState.chain1) {
        setDropdownState(prev => ({ ...prev, chain1: false }));
      }
      
      if (chain2Ref.current && !chain2Ref.current.contains(event.target as Node) && dropdownState.chain2) {
        setDropdownState(prev => ({ ...prev, chain2: false }));
      }
      
      if (token1Ref.current && !token1Ref.current.contains(event.target as Node) && dropdownState.token1) {
        setDropdownState(prev => ({ ...prev, token1: false }));
      }
      
      if (token2Ref.current && !token2Ref.current.contains(event.target as Node) && dropdownState.token2) {
        setDropdownState(prev => ({ ...prev, token2: false }));
      }
    }
    
    // 添加全局点击事件监听
    document.addEventListener("mousedown", handleClickOutside);
    
    // 清理函数
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownState]);

  // 当一个链被选择时，从另一个选择器中排除该选项
  useEffect(() => {
    if (chain1 && chain1 === chain2) {
      setChain2('');
    }
  }, [chain1]);

  useEffect(() => {
    if (chain2 && chain1 === chain2) {
      setChain1('');
    }
  }, [chain2]);

  // 当一个代币被选择时，从另一个选择器中排除该选项
  useEffect(() => {
    if (token1 && token1 === token2) {
      setToken2('');
    }
  }, [token1]);

  useEffect(() => {
    if (token2 && token1 === token2) {
      setToken1('');
    }
  }, [token2]);

  // 使用本地图片的区块链选项
  const chainOptions = [
    { 
      value: 'ethereum', 
      label: 'Ethereum', 
      icon: ethereumIcon
    },
    { 
      value: 'binance', 
      label: 'BSC', 
      icon: bnbIcon
    },
    { 
      value: 'polygon', 
      label: 'Polygon', 
      icon: polygonIcon
    },
    { 
      value: 'avalanche', 
      label: 'Avalanche', 
      icon: avalancheIcon
    },
    { 
      value: 'solana', 
      label: 'Solana', 
      icon: solanaIcon
    },
    { 
      value: 'sui', 
      label: 'Sui', 
      icon: suiIcon
    },
    { 
      value: 'aptos', 
      label: 'Aptos', 
      icon: aptosIcon
    },
    {
      value: 'base',
      label: 'Base',
      icon: baseIcon
    },
    {
      value: 'optimism',
      label: 'Optimism',
      icon: optimismIcon
    },
    {
      value: 'arbitrum',
      label: 'Arbitrum',
      icon: arbitrumIcon
    },
  ];

  // 使用本地图片的代币1选项
  const token1Options = [
    { 
      value: 'ETH', 
      label: 'ETH', 
      icon: ethTokenIcon
    },
    { 
      value: 'BTC', 
      label: 'BTC', 
      icon: btcTokenIcon
    },
    { 
      value: 'BNB', 
      label: 'BNB', 
      icon: bnbTokenIcon
    },
    { 
      value: 'SOL', 
      label: 'SOL', 
      icon: solTokenIcon
    },
    { 
      value: 'MATIC', 
      label: 'MATIC', 
      icon: maticTokenIcon
    },
    { 
      value: 'AVAX', 
      label: 'AVAX', 
      icon: avaxTokenIcon
    },
    { 
      value: 'SUI', 
      label: 'SUI', 
      icon: suiTokenIcon
    },
  ];

  // 使用本地图片的代币2选项 - 限制为稳定币
  const token2Options = [
    { 
      value: 'USDT', 
      label: 'USDT', 
      icon: usdtTokenIcon
    },
    { 
      value: 'USDC', 
      label: 'USDC', 
      icon: usdcTokenIcon
    },
    { 
      value: 'USDE', 
      label: 'USDE', 
      icon: usdeTokenIcon
    }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentAccount) {
      alert('Please connect your wallet first');
      return;
    }

    if (!chain1 || !chain2 || !token1 || !token2) {
      alert('Please select chain networks and tokens');
      return;
    }

    // 构建 tokenPair
    const tokenPair = `${token1}-${token2}`;
    
    // 构建 chain_pairs 格式为 [chain1:tokenPair, chain2:tokenPair]
    const chainPairs = [
      `${chain1}:${tokenPair}`,
      `${chain2}:${tokenPair}`
    ];

    onSubmit({
      chain_pairs: chainPairs,
      threshold,
      cooldown
    });
  };

  // 自定义下拉选择器的点击处理
  const toggleDropdown = (dropdownName: 'chain1' | 'chain2' | 'token1' | 'token2') => {
    setDropdownState({
      ...dropdownState,
      [dropdownName]: !dropdownState[dropdownName]
    });
  };

  // 选择链的处理
  const handleSelectChain = (value: string, field: 'chain1' | 'chain2') => {
    // 确保不能在两个选择器中选择相同的链
    if (field === 'chain1') {
      if (value === chain2) {
        // 如果选择的chain1与chain2相同，清空chain2
        setChain2('');
      }
      setChain1(value);
    } else {
      if (value === chain1) {
        // 如果选择的chain2与chain1相同，清空chain1
        setChain1('');
      }
      setChain2(value);
    }
    
    // 关闭相应的下拉菜单
    if (field === 'chain1') {
      setDropdownState({
        ...dropdownState,
        chain1: false
      });
    } else {
      setDropdownState({
        ...dropdownState,
        chain2: false
      });
    }
  };

  // 选择代币的处理
  const handleSelectToken1 = (value: string) => {
    // 确保不能在两个选择器中选择相同的代币
    if (value === token2) {
      // 如果选择的token1与token2相同，清空token2
      setToken2('');
    }
    setToken1(value);
    toggleDropdown('token1');
  };

  const handleSelectToken2 = (value: string) => {
    // 确保不能在两个选择器中选择相同的代币
    if (value === token1) {
      // 如果选择的token2与token1相同，清空token1
      setToken1('');
    }
    setToken2(value);
    toggleDropdown('token2');
  };

  // 获取当前选择的选项
  const getSelectedChain = (value: string) => {
    return chainOptions.find(option => option.value === value);
  };

  const getSelectedToken1 = () => {
    return token1Options.find(option => option.value === token1);
  };

  const getSelectedToken2 = () => {
    return token2Options.find(option => option.value === token2);
  };

  // 判断一个链选项是否可用（用于互斥检查）
  const isChainOptionDisabled = (value: string, dropdownName: 'chain1' | 'chain2') => {
    if (dropdownName === 'chain1') {
      return value === chain2;
    } else {
      return value === chain1;
    }
  };

  // 判断一个代币选项是否可用（用于互斥检查）
  const isTokenOptionDisabled = (value: string, dropdownName: 'token1' | 'token2') => {
    if (dropdownName === 'token1') {
      return value === token2;
    } else {
      return value === token1;
    }
  };

  // 样式
  const customSelectStyle = {
    position: 'relative' as const,
    width: '100%'
  };

  const customSelectTrigger = {
    width: '100%',
    padding: '8px 12px',
    border: 'none',
    borderRadius: '6px',
    outline: 'none',
    backgroundColor: '#f0f0f0',
    color: '#2563eb',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer' as const
  };

  const dropdownMenuStyle = {
    position: 'absolute' as const,
    top: 'calc(100% + 5px)',
    left: 0,
    width: '100%',
    backgroundColor: 'white',
    borderRadius: '6px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    zIndex: 10,
    maxHeight: '200px',
    overflowY: 'auto' as const
  };

  const dropdownItemStyle = {
    padding: '8px 12px',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer' as const,
    transition: 'background-color 0.2s',
    color: '#000000',
    textAlign: 'left' as const,
    justifyContent: 'flex-start'
  };

  const dropdownItemHoverStyle = {
    backgroundColor: '#e8f4ff'
  };

  const iconStyle = {
    width: '24px',
    height: '24px',
    marginRight: '8px',
    objectFit: 'contain' as const
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    border: 'none',
    borderRadius: '6px',
    outline: 'none',
    backgroundColor: '#f0f0f0',
    color: '#2563eb'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '14px',
    fontWeight: 500 as const,
    color: '#374151',
    marginBottom: '4px'
  };

  const disabledItemStyle = {
    opacity: 0.5,
    cursor: 'not-allowed' as const,
    backgroundColor: '#f3f4f6'
  };

  return (
    <div style={{ backgroundColor: '#121212', color: '#FFFFFF' }}>
      <form 
        onSubmit={handleSubmit} 
        style={{
          marginBottom: '16px',
          padding: '16px',
          backgroundColor: '#1E1E1E',
          borderRadius: '8px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
        }}
      >
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            {/* Chain 1 自定义下拉选择器 */}
            <div style={{ flex: 1 }}>
              <label style={{...labelStyle, fontSize: '12px'}}>Chain 1</label>
              <div style={customSelectStyle} ref={chain1Ref}>
                <div 
                  onClick={() => toggleDropdown('chain1')}
                  style={{
                    ...customSelectTrigger, 
                    justifyContent: 'flex-start'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    {chain1 && getSelectedChain(chain1) ? (
                      <>
                        <img 
                          src={getSelectedChain(chain1)?.icon} 
                          alt={getSelectedChain(chain1)?.label} 
                          style={iconStyle} 
                        />
                        <span>{getSelectedChain(chain1)?.label}</span>
                      </>
                    ) : (
                      <span>Select Chain 1</span>
                    )}
                  </div>
                  <span>▼</span>
                </div>
                
                {dropdownState.chain1 && (
                  <div style={dropdownMenuStyle}>
                    {chainOptions.map(option => {
                      const isDisabled = isChainOptionDisabled(option.value, 'chain1');
                      return (
                        <div 
                          key={option.value} 
                          style={{
                            ...dropdownItemStyle,
                            ...(isDisabled ? disabledItemStyle : {}),
                            backgroundColor: option.value === chain1 ? '#e6f2ff' : 'transparent'
                          }}
                          onClick={() => !isDisabled && handleSelectChain(option.value, 'chain1')}
                          onMouseOver={(e) => {
                            if (!isDisabled) {
                              e.currentTarget.style.backgroundColor = '#e8f4ff';
                            }
                          }}
                          onMouseOut={(e) => {
                            if (!isDisabled) {
                              e.currentTarget.style.backgroundColor = option.value === chain1 ? '#e6f2ff' : 'transparent';
                            }
                          }}
                        >
                          <img src={option.icon} alt={option.label} style={iconStyle} />
                          <span>{option.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            
            {/* Chain 2 自定义下拉选择器 */}
            <div style={{ flex: 1 }}>
              <label style={{...labelStyle, fontSize: '12px'}}>Chain 2</label>
              <div style={customSelectStyle} ref={chain2Ref}>
                <div 
                  onClick={() => toggleDropdown('chain2')}
                  style={{
                    ...customSelectTrigger, 
                    justifyContent: 'flex-start'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    {chain2 && getSelectedChain(chain2) ? (
                      <>
                        <img 
                          src={getSelectedChain(chain2)?.icon} 
                          alt={getSelectedChain(chain2)?.label} 
                          style={iconStyle} 
                        />
                        <span>{getSelectedChain(chain2)?.label}</span>
                      </>
                    ) : (
                      <span>Select Chain 2</span>
                    )}
                  </div>
                  <span>▼</span>
                </div>
                
                {dropdownState.chain2 && (
                  <div style={dropdownMenuStyle}>
                    {chainOptions.map(option => {
                      const isDisabled = isChainOptionDisabled(option.value, 'chain2');
                      return (
                        <div 
                          key={option.value} 
                          style={{
                            ...dropdownItemStyle,
                            ...(isDisabled ? disabledItemStyle : {}),
                            backgroundColor: option.value === chain2 ? '#e6f2ff' : 'transparent'
                          }}
                          onClick={() => !isDisabled && handleSelectChain(option.value, 'chain2')}
                          onMouseOver={(e) => {
                            if (!isDisabled) {
                              e.currentTarget.style.backgroundColor = '#e8f4ff';
                            }
                          }}
                          onMouseOut={(e) => {
                            if (!isDisabled) {
                              e.currentTarget.style.backgroundColor = option.value === chain2 ? '#e6f2ff' : 'transparent';
                            }
                          }}
                        >
                          <img src={option.icon} alt={option.label} style={iconStyle} />
                          <span>{option.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Token选择器行 */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            {/* Token 1 自定义下拉选择器 */}
            <div style={{ flex: 1 }}>
              <label style={{...labelStyle, fontSize: '12px'}}>Token 1</label>
              <div style={customSelectStyle} ref={token1Ref}>
                <div 
                  onClick={() => toggleDropdown('token1')}
                  style={{
                    ...customSelectTrigger,
                    justifyContent: 'flex-start'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    {token1 && getSelectedToken1() ? (
                      <>
                        <img 
                          src={getSelectedToken1()?.icon} 
                          alt="Token" 
                          style={iconStyle} 
                        />
                        <span>{getSelectedToken1()?.label}</span>
                      </>
                    ) : (
                      <span>Select Token 1</span>
                    )}
                  </div>
                  <span>▼</span>
                </div>
                
                {dropdownState.token1 && (
                  <div style={dropdownMenuStyle}>
                    {token1Options.map(option => {
                      const isDisabled = isTokenOptionDisabled(option.value, 'token1');
                      return (
                        <div 
                          key={option.value} 
                          style={{
                            ...dropdownItemStyle,
                            ...(isDisabled ? disabledItemStyle : {}),
                            backgroundColor: option.value === token1 ? '#e6f2ff' : 'transparent'
                          }}
                          onClick={() => !isDisabled && handleSelectToken1(option.value)}
                          onMouseOver={(e) => {
                            if (!isDisabled) {
                              e.currentTarget.style.backgroundColor = '#e8f4ff';
                            }
                          }}
                          onMouseOut={(e) => {
                            if (!isDisabled) {
                              e.currentTarget.style.backgroundColor = option.value === token1 ? '#e6f2ff' : 'transparent';
                            }
                          }}
                        >
                          <img src={option.icon} alt="Token" style={iconStyle} />
                          <span>{option.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
      </div>

            {/* Token 2 自定义下拉选择器 */}
            <div style={{ flex: 1 }}>
              <label style={{...labelStyle, fontSize: '12px'}}>Token 2</label>
              <div style={customSelectStyle} ref={token2Ref}>
                <div 
                  onClick={() => toggleDropdown('token2')}
                  style={{
                    ...customSelectTrigger,
                    justifyContent: 'flex-start'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    {token2 && getSelectedToken2() ? (
                      <>
                        <img 
                          src={getSelectedToken2()?.icon} 
                          alt="Token" 
                          style={iconStyle} 
                        />
                        <span>{getSelectedToken2()?.label}</span>
                      </>
                    ) : (
                      <span>Select Token 2</span>
                    )}
                  </div>
                  <span>▼</span>
      </div>

                {dropdownState.token2 && (
                  <div style={dropdownMenuStyle}>
                    {token2Options.map(option => {
                      const isDisabled = isTokenOptionDisabled(option.value, 'token2');
                      return (
                        <div 
                          key={option.value} 
                          style={{
                            ...dropdownItemStyle,
                            ...(isDisabled ? disabledItemStyle : {}),
                            backgroundColor: option.value === token2 ? '#e6f2ff' : 'transparent'
                          }}
                          onClick={() => !isDisabled && handleSelectToken2(option.value)}
                          onMouseOver={(e) => {
                            if (!isDisabled) {
                              e.currentTarget.style.backgroundColor = '#e8f4ff';
                            }
                          }}
                          onMouseOut={(e) => {
                            if (!isDisabled) {
                              e.currentTarget.style.backgroundColor = option.value === token2 ? '#e6f2ff' : 'transparent';
                            }
                          }}
                        >
                          <img src={option.icon} alt="Token" style={iconStyle} />
                          <span>{option.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>
            Price Difference Threshold (%)
        </label>
        <input
          type="number"
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          min="0.1"
          step="0.1"
            style={{
              ...inputStyle,
              backgroundColor: '#252525',
              color: '#FFFFFF',
              borderColor: '#333333'
            }}
        />
      </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>
            Cooldown Period (seconds)
        </label>
        <input
          type="number"
          value={cooldown}
          onChange={(e) => setCooldown(Number(e.target.value))}
          min="60"
          step="60"
            style={{
              ...inputStyle,
              backgroundColor: '#252525',
              color: '#FFFFFF',
              borderColor: '#333333'
            }}
        />
      </div>

      <button
        type="submit"
          disabled={!currentAccount}
          style={{
            width: '100%',
            padding: '8px 16px',
            borderRadius: '6px',
            color: 'white',
            fontWeight: 500,
            backgroundColor: '#3385FF',
            cursor: currentAccount ? 'pointer' : 'not-allowed',
            border: 'none'
          }}
        >
          Create Task
      </button>
    </form>
    </div>
  );
} 