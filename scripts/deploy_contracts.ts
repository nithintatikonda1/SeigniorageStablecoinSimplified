import { deploy } from './ethers-lib'

(async () => {
  try {
    const cash = await deploy('Cash', [])
    const cashAddress = cash.address
    console.log(`cash address: ${cashAddress}`)

    const bond = await deploy('Bond', [])
    const bondAddress = bond.address
    console.log(`bond address: ${bondAddress}`)

    const share = await deploy('Share', [])
    const shareAddress = share.address
    console.log(`share address: ${shareAddress}`)

    const oracle = await deploy('Oracle', [])
    const oracleAddress = oracle.address
    console.log(`oracle address: ${oracleAddress}`)

    const boardroom = await deploy('Boardroom', [cashAddress, shareAddress])
    const boardroomAddress = boardroom.address
    console.log(`boardroom address: ${boardroomAddress}`)

    const treasury = await deploy('Treasuryy', [cashAddress, bondAddress, shareAddress, oracleAddress, boardroomAddress])
    const treasuryAddress = treasury.address
    console.log(`treasury address: ${treasuryAddress}`)

  } catch (e) {
    console.log(e.message)
  }
})()