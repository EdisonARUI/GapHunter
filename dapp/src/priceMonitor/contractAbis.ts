/**
 * 合约ABI定义
 */

// UniswapV2式ERC20-Pair接口
export const IUniswapV2PairABI = [
  // 常用的查询方法
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function name() external view returns (string)",
  "function symbol() external view returns (string)"
];

// UniswapV3式Pool接口
export const IUniswapV3PoolABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)"
];

// Chainlink预言机接口
export const IChainlinkAggregatorABI = [
  "function latestAnswer() external view returns (int256)",
  "function latestRound() external view returns (uint256)",
  "function latestTimestamp() external view returns (uint256)",
  "function decimals() external view returns (uint8)"
];

// ERC20代币接口
export const IERC20ABI = [
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
  "function totalSupply() external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)"
]; 