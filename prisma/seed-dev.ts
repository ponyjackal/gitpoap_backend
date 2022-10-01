/*
 * This file is used to seed your development database & can be freely edited without risk of breaking
 * integration tests.
 */

import 'reflect-metadata';
import { ClaimStatus, GitPOAPStatus } from '@generated/type-graphql';
import {
  AddressFactory,
  ClaimFactory,
  FeaturedPOAPFactory,
  GitPOAPFactory,
  OrganizationFactory,
  ProfileFactory,
  ProjectFactory,
  RedeemCodeFactory,
  RepoFactory,
  UserFactory,
} from './factories';
import { DateTime } from 'luxon';
import { ADDRESSES, GH_HANDLES, GH_IDS } from './constants';
import {
  event1,
  event2,
  event3,
  event19375,
  event29009,
  event34634,
  event36568,
  event36569,
  event36570,
  event36571,
  event36572,
  event36573,
  event36574,
  event36575,
  event36576,
  event37428,
  event37429,
  event37430,
} from './data';

export const seed = async () => {
  console.log('Starting DB seeding...');

  /* Create Users */
  const vitalik = await UserFactory.create(1, GH_HANDLES.vitalik);
  const colfax = await UserFactory.create(2, GH_HANDLES.colfax);
  const jay = await UserFactory.create(GH_IDS.jay, GH_HANDLES.jay);
  const burz = await UserFactory.create(GH_IDS.burz, GH_HANDLES.burz);
  const aldo = await UserFactory.create(GH_IDS.aldo, GH_HANDLES.aldo);
  const tyler = await UserFactory.create(GH_IDS.tyler, GH_HANDLES.tyler);
  const burz2 = await UserFactory.create(6, 'burzzzzz');
  const kayleen = await UserFactory.create(GH_IDS.kayleen, GH_HANDLES.kayleen);

  /* Create Address */
  const addressJay = await AddressFactory.create(ADDRESSES.jay);
  const addressBurz = await AddressFactory.create(ADDRESSES.burz);
  const addressBurz2 = await AddressFactory.create(ADDRESSES.burz2);
  const addressColfax = await AddressFactory.create(ADDRESSES.colfax);
  const addressVitalik = await AddressFactory.create(ADDRESSES.vitalik);
  const addressAldo = await AddressFactory.create(ADDRESSES.aldo);
  const addressTyler = await AddressFactory.create(ADDRESSES.tyler);
  const addressKayleen = await AddressFactory.create(ADDRESSES.kayleen);
  const addressRandom1 = await AddressFactory.create('0x89dab21047e6de0e77deee5f4f286d72be50b942');

  /* Create Projects */
  const frontendProject = await ProjectFactory.create();
  const backendProject = await ProjectFactory.create();
  const repo7Project = await ProjectFactory.create();
  const repo34Project = await ProjectFactory.create();
  const repo568Project = await ProjectFactory.create();
  const dopexProject = await ProjectFactory.create();
  const wagyuInstallerProject = await ProjectFactory.create();
  const botTestProject = await ProjectFactory.create();

  /* Create Organizations */
  const org1 = await OrganizationFactory.create(43, 'org43');
  const org2 = await OrganizationFactory.create(7, 'seven-heaven');
  const org3 = await OrganizationFactory.create(34343, 'some-other-org');
  const org4 = await OrganizationFactory.create(
    1,
    'gitpoap',
    'A recognition platform for recognizing and rewarding your contributors through POAPs.',
    'gitpoap',
    'http://gitpoap.io',
  );
  const org5 = await OrganizationFactory.create(GH_IDS.burz, 'burz');
  const org6 = await OrganizationFactory.create(81711181, 'stake-house');

  /* Create Repos */
  const gitpoapFeRepo = await RepoFactory.create('gitpoap-fe', 439490658, org4.id, frontendProject.id); // real id
  const gitpoapBackendRepo = await RepoFactory.create('gitpoap-backend', 416584564, org4.id, backendProject.id); // real id
  const repo7 = await RepoFactory.create('repo7', 7, org2.id, repo7Project.id);
  const repo34 = await RepoFactory.create('repo34', 34, org1.id, repo34Project.id);
  const repo568 = await RepoFactory.create('repo568', 568, org3.id, repo568Project.id);
  const repoDopex = await RepoFactory.create('dopex', 127534193, org5.id, dopexProject.id);
  const repoWagyuInstaller = await RepoFactory.create('wagyu-installer', 336862756, org6.id, wagyuInstallerProject.id);
  const gitpoapBotTestRepo = await RepoFactory.create('gitpoap-bot-test-repo', 502133931, org4.id, botTestProject.id); // real id

  /* Create GitPOAPs */
  const gitpoap1 = await GitPOAPFactory.createFromEvent(repo34Project.id, event1, GitPOAPStatus.APPROVED);
  const gitpoap2 = await GitPOAPFactory.createFromEvent(repo7Project.id, event2, GitPOAPStatus.APPROVED);
  const gitpoap3 = await GitPOAPFactory.createFromEvent(repo568Project.id, event3, GitPOAPStatus.APPROVED);
  // For GitPOAP FE Repo ~ Using generic GitPOAP related POAP for now ~ eventID: 19375
  const gitpoap4 = await GitPOAPFactory.createFromEvent(frontendProject.id, event19375, GitPOAPStatus.APPROVED);
  // For GitPOAP BE Repo ~ Using GitPOAP Strategy Meeting POAP for now ~ eventID: 29009
  const gitpoap5 = await GitPOAPFactory.createFromEvent(backendProject.id, event29009, GitPOAPStatus.APPROVED);
  // For burz/dopex repo ~ eventID: 34634
  const gitpoap6 = await GitPOAPFactory.createFromEvent(dopexProject.id, event34634);

  // For the gitpoaps created for the bug bash -~- March 2022
  const gitpoap7 = await GitPOAPFactory.createFromEvent(frontendProject.id, event36568, GitPOAPStatus.APPROVED);
  const gitpoap8 = await GitPOAPFactory.createFromEvent(frontendProject.id, event36569, GitPOAPStatus.APPROVED, false, 2, 2);
  const gitpoap9 = await GitPOAPFactory.createFromEvent(backendProject.id, event36570, GitPOAPStatus.APPROVED);
  const gitpoap10 = await GitPOAPFactory.createFromEvent(backendProject.id, event36571, GitPOAPStatus.APPROVED, false, 2, 2);
  const gitpoap11 = await GitPOAPFactory.createFromEvent(backendProject.id, event36572, GitPOAPStatus.APPROVED, false, 3, 3);
  // Not the real POAP secret!
  const gitpoap12 = await GitPOAPFactory.createFromEvent(wagyuInstallerProject.id, event37428, GitPOAPStatus.UNAPPROVED, true);
  const gitpoap13 = await GitPOAPFactory.createFromEvent(wagyuInstallerProject.id, event37429, GitPOAPStatus.UNAPPROVED, true, 2, 2);
  const gitpoap14 = await GitPOAPFactory.createFromEvent(wagyuInstallerProject.id, event37430, GitPOAPStatus.UNAPPROVED, true, 3, 3);

  // For gitpoap-bot-test-repo (uses random POAP IDs)
  const gitpoap15 = await GitPOAPFactory.createFromEvent(botTestProject.id, event36573, GitPOAPStatus.APPROVED, true);
  const gitpoap16 = await GitPOAPFactory.createFromEvent(botTestProject.id, event36574, GitPOAPStatus.APPROVED, true, 2, 2);
  // Add one that is NOT enabled
  const gitpoap17 = await GitPOAPFactory.createFromEvent(botTestProject.id, event36575, GitPOAPStatus.APPROVED, true, 3, 3, false);
  // Add one that is deprecated
  const gitpoap18 = await GitPOAPFactory.createFromEvent(botTestProject.id, event36576, GitPOAPStatus.DEPRECATED);

  /* Add codes */
  await RedeemCodeFactory.addRedeemCodes(['6j8wda', 'tqaq9y', 'd4tdh0', 'o9uorf', 'eeyewe', '09wqld', 'tsl7wt', 'i52wvt', 'mshofb', 'v9cbcd'], gitpoap7.id);
  await RedeemCodeFactory.addRedeemCodes(['7s4dn3', 'q9237f', 'd0e21q', 'qzaj5c', 'ozy2c9', 'p7yqjo', 'cgsevm', 'hou5kq', 'j6sxom', '058qv8'], gitpoap8.id);
  await RedeemCodeFactory.addRedeemCodes(['plw7uf', 'rea9f5', '1etkax', 'l4uulx', '8hnrqa', '2mfo3x', 'me3qfx', 's8znfh', 'gelwgm', 'ebafk6'], gitpoap9.id);
  await RedeemCodeFactory.addRedeemCodes(['492wr5', 'zzxoaa', 'fnc0cn', 'hrir8p', 'v1258v', 'i7lt58', 'erxgdb', 'za5od3', 'v8a1wg', 'uazjii'], gitpoap10.id);
  await RedeemCodeFactory.addRedeemCodes(['hh3zf2', 'ivnnil', 'wylm9j', 'c8i5qj', '8inyd8', 'xyrepl', 'q4564p', 'aienlq', 'ohgtbi', 'qtr3ju'], gitpoap11.id);

  /* Create Claims */
  // GitPOAP 1
  const claim1 = await ClaimFactory.create(gitpoap1.id, vitalik.id, ClaimStatus.CLAIMED, addressBurz.id, 'thunderdome', DateTime.utc(2020, 1, 1).toJSDate());
  const claim2 = await ClaimFactory.create(gitpoap1.id, jay.id, ClaimStatus.CLAIMED, addressJay.id, '4068606', DateTime.utc(2020, 1, 2).toJSDate());
  const claim3 = await ClaimFactory.create(gitpoap1.id, tyler.id);

  // GitPOAP 2
  const claim4 = await ClaimFactory.create(gitpoap2.id, vitalik.id, ClaimStatus.CLAIMED, addressBurz.id, 'ethdenver', DateTime.utc(2020, 1, 3).toJSDate());
  const claim5 = await ClaimFactory.create(gitpoap2.id, jay.id, ClaimStatus.CLAIMED, addressJay.id, '4078452', DateTime.utc(2020, 1, 4).toJSDate());
  const claim6 = await ClaimFactory.create(gitpoap2.id, burz.id);
  const claim7 = await ClaimFactory.create(gitpoap2.id, tyler.id);

  // GitPOAP 3
  const claim8 = await ClaimFactory.create(gitpoap3.id, burz.id, ClaimStatus.CLAIMED, addressBurz.id, 'pizza-pie', DateTime.utc(2022, 4, 5).toJSDate());
  const claim9 = await ClaimFactory.create(gitpoap3.id, jay.id, ClaimStatus.CLAIMED, addressJay.id, '4082459', DateTime.utc(2020, 1, 5).toJSDate());
  const claim10 = await ClaimFactory.create(gitpoap3.id, tyler.id);

  // GitPOAP 4 - GitPOAP FE Repo
  const claim11 = await ClaimFactory.create(gitpoap4.id, burz.id);
  const claim12 = await ClaimFactory.create(gitpoap4.id, colfax.id);
  const claim13 = await ClaimFactory.create(gitpoap4.id, vitalik.id);
  const claim14 = await ClaimFactory.create(gitpoap4.id, jay.id, ClaimStatus.CLAIMED, addressJay.id, '3217451', DateTime.utc(2020, 1, 6).toJSDate());
  const claim15 = await ClaimFactory.create(gitpoap4.id, tyler.id);

  // GitPOAP 5 - GitPOAP BE Repo
  const claim16 = await ClaimFactory.create(gitpoap5.id, burz.id, ClaimStatus.CLAIMED, addressBurz.id, '3973554', DateTime.utc(2020, 1, 7).toJSDate());
  const claim17 = await ClaimFactory.create(gitpoap5.id, colfax.id, ClaimStatus.CLAIMED, addressColfax.id, '4126448', DateTime.utc(2020, 1, 8).toJSDate());
  const claim18 = await ClaimFactory.create(gitpoap5.id, jay.id);
  const claim19 = await ClaimFactory.create(gitpoap5.id, tyler.id);
  const claim20 = await ClaimFactory.create(gitpoap5.id, vitalik.id);
  const claim21 = await ClaimFactory.create(gitpoap5.id, burz2.id, ClaimStatus.CLAIMED, addressBurz2.id, '123456789', DateTime.utc(2020, 1, 9).toJSDate());

  // GitPOAPs 7 - GitPOAP BugBash Repos
  const claim22 = await ClaimFactory.create(gitpoap7.id, jay.id);
  const claim23 = await ClaimFactory.create(gitpoap7.id, burz.id);
  const claim24 = await ClaimFactory.create(gitpoap7.id, colfax.id);
  const claim25 = await ClaimFactory.create(gitpoap7.id, aldo.id);

  // GitPOAPs 8 - GitPOAP BugBash Repos
  const claim26 = await ClaimFactory.create(gitpoap8.id, jay.id);
  const claim27 = await ClaimFactory.create(gitpoap8.id, burz.id);
  const claim28 = await ClaimFactory.create(gitpoap8.id, colfax.id);
  const claim29 = await ClaimFactory.create(gitpoap8.id, aldo.id);

  // GitPOAPs 9 - GitPOAP BugBash Repos
  const claim30 = await ClaimFactory.create(gitpoap9.id, jay.id);
  const claim31 = await ClaimFactory.create(gitpoap9.id, burz.id, ClaimStatus.CLAIMED, addressBurz.id, '1234567891', DateTime.utc(2020, 1, 9).toJSDate());
  const claim32 = await ClaimFactory.create(gitpoap9.id, colfax.id, ClaimStatus.CLAIMED, addressColfax.id, '1234567892', DateTime.utc(2020, 1, 9).toJSDate());
  const claim33 = await ClaimFactory.create(gitpoap9.id, aldo.id);

  // GitPOAPs 10 - GitPOAP BugBash Repos
  const claim34 = await ClaimFactory.create(gitpoap10.id, jay.id);
  const claim35 = await ClaimFactory.create(gitpoap10.id, burz.id);
  const claim36 = await ClaimFactory.create(gitpoap10.id, colfax.id, ClaimStatus.CLAIMED, addressColfax.id, '1234567893', DateTime.utc(2020, 1, 9).toJSDate());
  const claim37 = await ClaimFactory.create(gitpoap10.id, aldo.id);

  // GitPOAPs 11 - GitPOAP BugBash Repos
  const claim38 = await ClaimFactory.create(gitpoap11.id, jay.id);
  const claim39 = await ClaimFactory.create(gitpoap11.id, burz.id);
  const claim40 = await ClaimFactory.create(gitpoap11.id, colfax.id);
  const claim41 = await ClaimFactory.create(gitpoap11.id, aldo.id, ClaimStatus.CLAIMED, addressAldo.id, '1234567894', DateTime.utc().minus({ days: 2 }).toJSDate());

  // GitPOAP 18 - Deprecated
  const claim42 = await ClaimFactory.create(gitpoap18.id, burz.id, ClaimStatus.CLAIMED, addressBurz.id, '77777', DateTime.utc(2019, 12, 11).toJSDate());
  const claim43 = await ClaimFactory.create(gitpoap18.id, kayleen.id, ClaimStatus.CLAIMED, addressKayleen.id, '77778', DateTime.utc(2019, 12, 11).toJSDate());

  /* Create Profiles */
  const profile1 = await ProfileFactory.create(addressColfax.id, 'I like brisket.');
  const profile2 = await ProfileFactory.create(addressRandom1.id, 'I like bbq.');
  const profileJay = await ProfileFactory.create(addressJay.id, 'I like factorio.', 'Jay PB', '0xpeebeejay', 'jaypb1', 'https://s.jay.gg');
  const profile4 = await ProfileFactory.create(addressBurz.id, 'I am addicted to POAPs', 'Anna Burzillo');
  const profile5 = await ProfileFactory.create(addressBurz2.id, 'I am not real');
  const profile6 = await ProfileFactory.create(addressVitalik.id, 'I like unicorns');
  const profile7 = await ProfileFactory.create(addressAldo.id, 'I like surfing', 'Aldo Lamberti');

  /* Create Featured POAPs */
  const featured1 = await FeaturedPOAPFactory.create(claim14.poapTokenId!, profileJay.id); // Featured GitPOAP
  const featured2 = await FeaturedPOAPFactory.create(claim9.poapTokenId!, profileJay.id); // Featured GitPOAP
  const featured3 = await FeaturedPOAPFactory.create('3976027', profileJay.id); // Featured Classic POAP - Bangia Night

  console.log('DB Seeding complete. ');
};