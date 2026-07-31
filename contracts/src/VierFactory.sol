// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IInvoiceNFTConfig {
    function setYieldVault(address yieldVault) external;
    function setAgentRouter(address agentRouter) external;
    function setOracle(address oracle) external;
    function transferOwnership(address newOwner) external;
}

interface IYieldVaultConfig {
    function setAgentRouter(address agentRouter) external;
    function transferOwnership(address newOwner) external;
}

interface IAgentRouterConfig {
    function transferOwnership(address newOwner) external;
}

interface IOwnableConfig {
    function transferOwnership(address newOwner) external;
}

/// @title VierFactory - Atomic deployment of vier Protocol
/// @notice Deploys and wires the protocol stack without embedding child contract bytecode.
/// @dev Callers pass audited creation bytecode from build artifacts, keeping factory runtime deployable on production networks.
contract VierFactory {
    struct ProtocolBytecode {
        bytes invoiceNFT;
        bytes yieldVault;
        bytes agentRouter;
        bytes mockOracle;
        bytes privacyRegistry;
    }

    struct ProductionBytecode {
        bytes invoiceNFT;
        bytes yieldVault;
        bytes agentRouter;
        bytes privacyRegistry;
    }

    struct DeployedContracts {
        address invoiceNFT;
        address yieldVault;
        address agentRouter;
        address mockOracle;
        address privacyRegistry;
    }

    event ProtocolDeployed(
        address indexed deployer,
        address invoiceNFT,
        address yieldVault,
        address agentRouter,
        address mockOracle,
        address privacyRegistry
    );

    error EmptyBytecode();
    error DeploymentFailed();
    error InvalidOracle();

    /// @notice Deploy the complete demo stack, including MockOracle.
    function deployProtocol(ProtocolBytecode calldata bytecode)
        external
        returns (DeployedContracts memory contracts)
    {
        contracts.invoiceNFT = _deploy(bytecode.invoiceNFT);
        contracts.yieldVault = _deployWithArgs(bytecode.yieldVault, abi.encode(contracts.invoiceNFT));
        contracts.agentRouter = _deployWithArgs(
            bytecode.agentRouter,
            abi.encode(contracts.invoiceNFT, contracts.yieldVault)
        );
        contracts.mockOracle = _deployWithArgs(bytecode.mockOracle, abi.encode(contracts.invoiceNFT));
        contracts.privacyRegistry = _deploy(bytecode.privacyRegistry);

        _configureAndTransfer(contracts, contracts.mockOracle, true);
    }

    /// @notice Deploy the production stack with a pre-deployed oracle such as PythOracle.
    function deployProtocolWithOracle(ProductionBytecode calldata bytecode, address oracleAddress)
        external
        returns (DeployedContracts memory contracts)
    {
        if (oracleAddress == address(0)) revert InvalidOracle();

        contracts.invoiceNFT = _deploy(bytecode.invoiceNFT);
        contracts.yieldVault = _deployWithArgs(bytecode.yieldVault, abi.encode(contracts.invoiceNFT));
        contracts.agentRouter = _deployWithArgs(
            bytecode.agentRouter,
            abi.encode(contracts.invoiceNFT, contracts.yieldVault)
        );
        contracts.mockOracle = oracleAddress;
        contracts.privacyRegistry = _deploy(bytecode.privacyRegistry);

        _configureAndTransfer(contracts, oracleAddress, false);
    }

    function _configureAndTransfer(DeployedContracts memory contracts, address oracleAddress, bool ownsOracle) private {
        IInvoiceNFTConfig invoiceNFT = IInvoiceNFTConfig(contracts.invoiceNFT);
        invoiceNFT.setYieldVault(contracts.yieldVault);
        invoiceNFT.setAgentRouter(contracts.agentRouter);
        invoiceNFT.setOracle(oracleAddress);

        IYieldVaultConfig(contracts.yieldVault).setAgentRouter(contracts.agentRouter);

        invoiceNFT.transferOwnership(msg.sender);
        IYieldVaultConfig(contracts.yieldVault).transferOwnership(msg.sender);
        IAgentRouterConfig(contracts.agentRouter).transferOwnership(msg.sender);
        IOwnableConfig(contracts.privacyRegistry).transferOwnership(msg.sender);

        if (ownsOracle) {
            IOwnableConfig(oracleAddress).transferOwnership(msg.sender);
        }

        emit ProtocolDeployed(
            msg.sender,
            contracts.invoiceNFT,
            contracts.yieldVault,
            contracts.agentRouter,
            contracts.mockOracle,
            contracts.privacyRegistry
        );
    }

    function _deploy(bytes calldata creationCode) private returns (address deployed) {
        if (creationCode.length == 0) revert EmptyBytecode();

        bytes memory code = creationCode;
        assembly {
            deployed := create(0, add(code, 0x20), mload(code))
        }

        if (deployed == address(0)) revert DeploymentFailed();
    }

    function _deployWithArgs(bytes calldata creationCode, bytes memory constructorArgs)
        private
        returns (address deployed)
    {
        if (creationCode.length == 0) revert EmptyBytecode();

        bytes memory code = bytes.concat(creationCode, constructorArgs);
        assembly {
            deployed := create(0, add(code, 0x20), mload(code))
        }

        if (deployed == address(0)) revert DeploymentFailed();
    }
}