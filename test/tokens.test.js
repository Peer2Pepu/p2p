const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Token Contracts", function () {
  let p2pToken, penkToken, owner, addr1, addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const P2PToken = await ethers.getContractFactory("P2PToken");
    p2pToken = await P2PToken.deploy(owner.address, 1000000);

    const PENKToken = await ethers.getContractFactory("PENKToken");
    penkToken = await PENKToken.deploy(owner.address, 1000000);
  });

  describe("P2P Token", function () {
    it("Should have correct name and symbol", async function () {
      expect(await p2pToken.name()).to.equal("P2P Token");
      expect(await p2pToken.symbol()).to.equal("P2P");
    });

    it("Should assign initial supply to owner", async function () {
      const ownerBalance = await p2pToken.balanceOf(owner.address);
      expect(await p2pToken.totalSupply()).to.equal(ownerBalance);
    });

    it("Should allow owner to mint tokens", async function () {
      await p2pToken.mint(addr1.address, 100);
      expect(await p2pToken.balanceOf(addr1.address)).to.equal(100);
    });

    it("Should allow users to burn their own tokens", async function () {
      await p2pToken.transfer(addr1.address, 100);
      await p2pToken.connect(addr1).burn(50);
      expect(await p2pToken.balanceOf(addr1.address)).to.equal(50);
    });
  });

  describe("PENK Token", function () {
    it("Should have correct name and symbol", async function () {
      expect(await penkToken.name()).to.equal("PENK Token");
      expect(await penkToken.symbol()).to.equal("PENK");
    });

    it("Should assign initial supply to owner", async function () {
      const ownerBalance = await penkToken.balanceOf(owner.address);
      expect(await penkToken.totalSupply()).to.equal(ownerBalance);
    });

    it("Should allow owner to mint tokens", async function () {
      await penkToken.mint(addr1.address, 100);
      expect(await penkToken.balanceOf(addr1.address)).to.equal(100);
    });

    it("Should allow users to burn their own tokens", async function () {
      await penkToken.transfer(addr1.address, 100);
      await penkToken.connect(addr1).burn(50);
      expect(await penkToken.balanceOf(addr1.address)).to.equal(50);
    });
  });
});
