import Web3 from 'web3';

// 1. Thay thế bằng địa chỉ bạn thấy trong ảnh (Interacted With / To)
const CONTRACT_ADDRESS = "0xc574902660D1A42bf9565c4033B08b4F52F9A6A4"; 

// 2. Đảm bảo ABI này khớp với tên hàm trong Smart Contract của bạn
const CONTRACT_ABI = [
    {
        "inputs": [{ "internalType": "string", "name": "_hash", "type": "string" }],
        "name": "isDiplomaValid", // Nếu trong code Solidity bạn đặt tên khác, hãy sửa ở đây
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "view",
        "type": "function"
    }
];

export const verifyOnChain = async (diplomaHash) => {
    if (!window.ethereum) {
        console.warn("Metamask chưa được cài đặt");
        return false;
    }

    try {
        const web3 = new Web3(window.ethereum);
        const contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
        
        // Gọi hàm view từ Smart Contract
        // Lưu ý: diplomaHash phải là chuỗi 'e572d31d...' giống như trong DB của bạn
        const result = await contract.methods.isDiplomaValid(diplomaHash).call();
        return result;
    } catch (error) {
        console.error("Lỗi khi gọi Smart Contract:", error);
        return false;
    }
};