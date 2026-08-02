// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract MockFtsoV2 {
    uint256 public value;
    uint64 public timestamp;
    bool public shouldRevert;

    constructor(uint256 value_, uint64 timestamp_) {
        value = value_;
        timestamp = timestamp_;
    }

    function setFeed(uint256 value_, uint64 timestamp_) external {
        value = value_;
        timestamp = timestamp_;
    }

    function setShouldRevert(bool shouldRevert_) external {
        shouldRevert = shouldRevert_;
    }

    function getFeedByIdInWei(bytes21) external payable returns (uint256, uint64) {
        require(!shouldRevert, "FTSO unavailable");
        return (value, timestamp);
    }
}