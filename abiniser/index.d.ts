import { AugmintReserves_ABI_024b81d1a1f75241167a8a0f6e62326f } from "./types/AugmintReserves_ABI_024b81d1a1f75241167a8a0f6e62326f";
import { AugmintReserves_ABI_fe74b7986dafb00f221486e790fc70ec } from "./types/AugmintReserves_ABI_fe74b7986dafb00f221486e790fc70ec";
import { Exchange_ABI_b2a23202a9a0f04755a186896c2b56eb } from "./types/Exchange_ABI_b2a23202a9a0f04755a186896c2b56eb";
import { Exchange_ABI_c28de2392aea85ef2aa1b108fce6568c } from "./types/Exchange_ABI_c28de2392aea85ef2aa1b108fce6568c";
import { Exchange_ABI_d3e7f8a261b756f9c40da097608b21cd } from "./types/Exchange_ABI_d3e7f8a261b756f9c40da097608b21cd";
import { FeeAccount_ABI_67db260db12738df3cced3511d34c65c } from "./types/FeeAccount_ABI_67db260db12738df3cced3511d34c65c";
import { InterestEarnedAccount_ABI_11b039ce783db308e1a9b5f46f05824f } from "./types/InterestEarnedAccount_ABI_11b039ce783db308e1a9b5f46f05824f";
import { LoanManager_ABI_ec709c3341045caa3a75374b8cfc7286 } from "./types/LoanManager_ABI_ec709c3341045caa3a75374b8cfc7286";
import { LoanManager_ABI_fdf5fde95aa940c6dbfb8353c572c5fb } from "./types/LoanManager_ABI_fdf5fde95aa940c6dbfb8353c572c5fb";
import { Locker_ABI_619ff7809b73aead28176fe6317953c3 } from "./types/Locker_ABI_619ff7809b73aead28176fe6317953c3";
import { Locker_ABI_f59526398823aef0f0c1454d0b6b4eac } from "./types/Locker_ABI_f59526398823aef0f0c1454d0b6b4eac";
import { Migrations_ABI_78141a323f4a8416891b06a0a2b90065 } from "./types/Migrations_ABI_78141a323f4a8416891b06a0a2b90065";
import { MonetarySupervisor_ABI_54d27fedd8bf3010ad5509866a42c053 } from "./types/MonetarySupervisor_ABI_54d27fedd8bf3010ad5509866a42c053";
import { MonetarySupervisor_ABI_7f500b43397413e97de925528187f9cd } from "./types/MonetarySupervisor_ABI_7f500b43397413e97de925528187f9cd";
import { PreToken_ABI_10eebbb51a771cfd3473475169a569f1 } from "./types/PreToken_ABI_10eebbb51a771cfd3473475169a569f1";
import { PreToken_ABI_7f69e33e7b345c780ac9e43f391437d9 } from "./types/PreToken_ABI_7f69e33e7b345c780ac9e43f391437d9";
import { Rates_ABI_73a17ebb0acc71773371c6a8e1c8e6ce } from "./types/Rates_ABI_73a17ebb0acc71773371c6a8e1c8e6ce";
import { StabilityBoardProxy_ABI_19ab69b650e28b2dd211d3851893f91f } from "./types/StabilityBoardProxy_ABI_19ab69b650e28b2dd211d3851893f91f";
import { StabilityBoardProxy_ABI_dd40c0d39ea8bad8a388522667a84687 } from "./types/StabilityBoardProxy_ABI_dd40c0d39ea8bad8a388522667a84687";
import { TokenAEur_ABI_2ea91d34a7bfefc8f38ef0e8a5ae24a5 } from "./types/TokenAEur_ABI_2ea91d34a7bfefc8f38ef0e8a5ae24a5";
import { TokenAEur_ABI_9aa81519ec45a52d3f8f1a1a83d25c74 } from "./types/TokenAEur_ABI_9aa81519ec45a52d3f8f1a1a83d25c74";

declare module "*.json";

type AugmintReserves =
    | AugmintReserves_ABI_024b81d1a1f75241167a8a0f6e62326f
    | AugmintReserves_ABI_fe74b7986dafb00f221486e790fc70ec;
type Exchange =
    | Exchange_ABI_b2a23202a9a0f04755a186896c2b56eb
    | Exchange_ABI_c28de2392aea85ef2aa1b108fce6568c
    | Exchange_ABI_d3e7f8a261b756f9c40da097608b21cd;
type FeeAccount = FeeAccount_ABI_67db260db12738df3cced3511d34c65c;
type InterestEarnedAccount = InterestEarnedAccount_ABI_11b039ce783db308e1a9b5f46f05824f;
type LoanManager = LoanManager_ABI_ec709c3341045caa3a75374b8cfc7286 | LoanManager_ABI_fdf5fde95aa940c6dbfb8353c572c5fb;
type Locker = Locker_ABI_619ff7809b73aead28176fe6317953c3 | Locker_ABI_f59526398823aef0f0c1454d0b6b4eac;
type Migrations = Migrations_ABI_78141a323f4a8416891b06a0a2b90065;
type MonetarySupervisor =
    | MonetarySupervisor_ABI_7f500b43397413e97de925528187f9cd
    | MonetarySupervisor_ABI_54d27fedd8bf3010ad5509866a42c053;
type PreToken = PreToken_ABI_7f69e33e7b345c780ac9e43f391437d9 | PreToken_ABI_10eebbb51a771cfd3473475169a569f1;
type Rates = Rates_ABI_73a17ebb0acc71773371c6a8e1c8e6ce;
type StabilityBoardProxy =
    | StabilityBoardProxy_ABI_19ab69b650e28b2dd211d3851893f91f
    | StabilityBoardProxy_ABI_dd40c0d39ea8bad8a388522667a84687;
type TokenAEur = TokenAEur_ABI_2ea91d34a7bfefc8f38ef0e8a5ae24a5 | TokenAEur_ABI_9aa81519ec45a52d3f8f1a1a83d25c74;

declare enum AugmintContracts {
    AugmintReserves,
    Exchange,
    FeeAccount,
    InterestEarnedAccount,
    LoanManager,
    Locker,
    Migrations,
    MonetarySupervisor,
    PreToken,
    Rates,
    StabilityBoardProxy,
    TokenAEur
}
