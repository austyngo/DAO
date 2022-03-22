import { Contract, providers } from "ethers";
import { formatEther } from "ethers/lib/utils";
import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import Web3Modal from "web3modal";
import {
  CRYPTODEVS_DAO_ABI,
  CRYPTODEVS_DAO_CONTRACT_ADDRESS,
  CRYPTODEVS_NFT_ABI,
  CRYPTODEVS_NFT_CONTRACT_ADDRESS
} from "../constants";
import styles from "../styles/Home.module.css";

export default function Home() {
  // ETH balance of DAO contract
  const [treasuryBalance, setTreasuryBalance] = useState("0");
  // number of proposals created in DAO
  const [numProposals, setNumProposals] = useState("0");
  // array of all proposals created in DAO
  const [proposals, setProposals] = useState([]);
  // user's balance of CryptoDevs NFTs
  const [nftBalance, setNftBalance] = useState(0);
  // fake NFT tokenID to purchase, used whn creating proposal
  const [fakeNftTokenId, setFakeNftTokenId] = useState("");
  // one of "Create proposal" or "View proposal"
  const [selectedTab, setSelectedTab] = useState("");
  // true if waiting for a transaction to be mined, false otherwise
  const [loading, setLoading] = useState(false);
  // true if user has connected wallet, false otherwise
  const [walletConnected, setWalletConnected] = useState(false);
  const web3ModalRef = useRef();

  // helper function to connect wallet
  const connectWallet = async () => {
    try {
      await getProviderOrSigner(); //defined later
      setWalletConnected(true);
    } catch (error) {
      console.error(error);
    }
  };

  // reads ETH balance of DAO and sets the 'treasuryBalance' state variable
  const getDAOTreasuryBalance = async () => {
    try {
      const provider = await getProviderOrSigner();
      const balance = await provider.getBalance(CRYPTODEVS_DAO_CONTRACT_ADDRESS);
      setTreasuryBalance(balance.toString());
    } catch (error) {
      console.error(error);
    }
  };

  // reads number of proposals in the DAO contract and sets the 'numProposals' state variable
  const getNumProposalsInDAO = async () => {
    try {
      const provider = await getProviderOrSigner();
      const contract = getDaoContractInstance(provider); //defined later
      const daoNumProposals = await contract.numProposals();
      setNumProposals(daoNumProposals.toString());
    } catch (error) {
      console.error(error);
    }
  };

  // reads balance of user's CryptoDevs NFTs and sets the 'nftBalance' state variable
  const getUserNFTBalance = async () => {
    try {
      const signer = await getProviderOrSigner(true);
      const nftContract = getCryptodevsNFTContractInstance(signer); // defined later
      const balance = await nftContract.balanceOf(signer.getAddress());
      setNftBalance(parseInt(balance.toString()));
      console.log("nfts: ", nftBalance, balance)
    } catch (error) {
      console.error(error);
    }
  };

  const createProposal = async () => {
    try {
      const signer = await getProviderOrSigner(true);
      const daoContract = getDaoContractInstance(signer);
      const txn = await daoContract.createProposal(fakeNftTokenId);
      setLoading(true);
      await txn.wait();
      await getNumProposalsInDAO();
      setLoading(false);
    } catch (error) {
      console.error(error);
      window.alert(error.data.message);
    }
  };

  // helper function to fetch and parse one proposal from DAO contract
  // given proposal ID
  // and converts the returned data into a JS object with values we can use
  const fetchProposalById = async (id) => {
    try {
      const provider = await getProviderOrSigner();
      const daoContract = getDaoContractInstance(provider);
      const proposal = await daoContract.proposals(id);
      const parsedProposal = {
        proposalId: id,
        nftTokenId: proposal.nftTokenId.toString(),
        deadline: new Date(parseInt(proposal.deadline.toString())*1000),
        yayVotes: proposal.yayVotes.toString(),
        nayVotes: proposal.nayVotes.toString(),
        executed: proposal.executed,
      };
      return parsedProposal;
    } catch (error) {
      console.error(error);
    }
  };
  
  // runs a loop 'numProposals' times to fetch all proposals in DAO
  // and sets the 'proposals' state variable
  const fetchAllProposals = async () => {
    try {
      const proposals = [];
      for (let i=0; i < numProposals; i++) {
        const proposal = await fetchProposalById(i);
        proposals.push(proposal);
      }
      setProposals(proposals);
      return proposals;
    } catch (error) {
      console.error(error);
    }
  };

  // calls 'voteOnProposal function in the contract using passed proposal ID and Vote
  const voteOnProposal = async (proposalId, _vote) => {
    try {
      const signer = await getProviderOrSigner(true);
      const daoContract = getDaoContractInstance(signer);

      let vote = _vote == "YAY" ? 0 : 1;
      const txn = await daoContract.VoteOnProposal(proposalId, vote);
      setLoading(true);
      await txn.wait();
      setLoading(false);
      await fetchAllProposals();
    } catch (error) {
      console.error(error);
      window.alert(error.data.message);
    }
  }

  // calls 'executeProposal' function in the contract using the passed proposal ID
  const executeProposal = async (proposalId) => {
    try {
      const signer = await getProviderOrSigner(true);
      const daoContract = getDaoContractInstance(signer);
      const txn = await daoContract.executeProposal(proposalId);
      setLoading(true);
      await txn.wait();
      setLoading(false);
      await fetchAllProposals();
    } catch (error) {
      console.error(error);
      window.alert(error.data.message);
    }
  };

  // helper function to get provider/signer instance from MM
  const getProviderOrSigner = async (needSigner = false) => {
    const provider = await web3ModalRef.current.connect();
    const web3Provider = new providers.Web3Provider(provider);

    const { chainId } = await web3Provider.getNetwork();
    if (chainId !== 4 ) {
      window.alert("Please switch to the Rinkeby network");
      throw new Error("Please switch to the Rinkeby network");
    }

    if (needSigner) {
      const signer = web3Provider.getSigner();
      return signer;
    }
    return web3Provider;
  };

  // helper function to return a DAO contract instance
  const getDaoContractInstance = (providerOrSigner) => {
    return new Contract(
      CRYPTODEVS_DAO_CONTRACT_ADDRESS,
      CRYPTODEVS_DAO_ABI,
      providerOrSigner
    );
  };

  //helper function to retuyrn NFT contract Instance given provider/signer
  const getCryptodevsNFTContractInstance = (providerOrSigner) => {
    return new Contract(
      CRYPTODEVS_NFT_CONTRACT_ADDRESS,
      CRYPTODEVS_NFT_ABI,
      providerOrSigner
    );
  };
  
  // runs everytime the value of walletConnected changes
  // so when a wallet connects or disconnects, promts user to connect wallet if not connected
  // and then call helper functions to fetch the DAO treasyry balance, user NFT balance and number of proposals in DAO
  useEffect(() => {
    if (!walletConnected) {
      web3ModalRef.current = new Web3Modal({
        network: "rinkeby",
        providerOptions: {},
        disableInjectedProvider: false,
      });

      connectWallet().then(() => {
        getDAOTreasuryBalance();
        getUserNFTBalance();
        getNumProposalsInDAO();
      });
    }
  }, [walletConnected]);
  
  // runs everytime the value of 'selectedTab' changes
  // used to re-fetch all proposals in the DAO when the user switches to 'View Proposals' tab
  useEffect(() => {
    if (selectedTab === "View Proposals") {
      fetchAllProposals();
    }
  }, [selectedTab]);

  // render the contents of the appropriate tab based on 'selectedTab'
  function renderTabs() {
    if (selectedTab === "Create Proposal") {
      return renderCreateProposalTab(); // defined below
    } else if (selectedTab === "View Proposals") {
      return renderViewProposalsTab(); //defined below
    }
    return null; 
  }

  // renders 'Create Proposal' tab content
  function renderCreateProposalTab() {
    if (loading) {
      return (
        <div className={styles.description}>
          Loading.. Waiting for transaction..
        </div>
      );
    } else if (nftBalance === 0) {
      return (
        <div className={styles.description}>
          You do not own any CryptoDevs NFTs. <br />
          <b>You cannot create or vote on proposals</b>
        </div>
      );
    } else {
      return (
        <div className={styles.container}>
          <label> Fake NFT Token ID to Purhase: </label>
          <input placeholder="0" type="number" onChange={(e) => setFakeNftTokenId(e.target.value)}/> 
          <button className={styles.button2} onClick={createProposal}>
            Create
          </button>
        </div>
      );
    }
  }

  // renders the 'View Proposals' tab content
  function renderViewProposalsTab() {
    if (loading) {
      return (
        <div className={styles.description}>
          Loading.. Waiting for transaction..
        </div>
      );
    } else if (proposals.length === 0) {
      return (
        <div className={styles.description}>
          No proposals have been created
        </div>
      );
    } else {
      return (
        <div>
          {proposals.map((p,index) => (
            <div key={index} className={styles.proposalCard}>
              <p>Proposal ID: {p.proposalId}</p>
              <p>Fake NFT to Purhase: {p.nftTokenId}</p>
              <p>Deadline: {p.deadline.toLocaleString()}</p>
              <p>Yay Votes: {p.yayVotes}</p>
              <p>Nay Votes: {p.nayVotes}</p>
              <p>Executed?: {p.executed.toString()}</p>
              {p.deadline.getTime() > Date.now() && !p.executed ? (
                <div className={styles.flex}>
                  <button
                    className={styles.button2}
                    onClick={() => voteOnProposal(p.proposalId, "YAY")}
                  >
                    Vote YAY
                  </button>
                  <button
                    className={styles.button2}
                    onClick={() => voteOnProposal(p.proposalId, "NAY")}
                  >
                    Vote NAY
                  </button>
                </div>
              ) : p.deadline.getTime() < Date.now() && !p.executed ? (
                <div className={styles.flex}>
                  <button
                    className={styles.button2}
                    onClick={() => executeProposal(p.proposalId)}
                  >
                    Execute Proposal{""}
                    {p.yayVotes > p.nayVotes ? "(YAY)" : "(NAY)"}
                  </button>
                </div>
              ) : (
                <div className={styles.description}>Proposal Executed</div>
              )}
            </div>
          ))}
        </div>
      );
    }
  }

  return (
    <div>
      <Head>
        <title>CryptoDevs DAO</title>
        <meta name="description" content="CryptoDevs DAO" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={styles.main}>
        <div>
          <h1 className={styles.title}>Welcome to Crypto Devs!</h1>
          <div className={styles.description}>Welcome to the DAO!</div>
          <div className={styles.description}>
            Your CryptoDevs NFT Balance: {nftBalance}
            <br />
            Treasury Balance: {formatEther(treasuryBalance)} ETH
            <br />
            Total Number of Proposals: {numProposals}
          </div> 
          <div className={styles.flex}>
            <button
              className={styles.button}
              onClick={() => setSelectedTab("Create Proposal")}
            >
              Create Proposal
            </button>
            <button
              className={styles.button}
              onClick={() => setSelectedTab("View Proposals")}
            >
              View Proposals
            </button>
          </div>
          {renderTabs()}
        </div>
        <div>
          <img className={styles.image} src="/cryptodevs/0.svg" />
        </div>
      </div>
      <footer className={styles.footer}>
        Made with &#10084; by Crypto Devs
      </footer>
    </div>
  );

}