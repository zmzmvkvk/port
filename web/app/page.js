import Carousel from "@/components/Carousel";
import ClaimsPanel from "@/components/ClaimsPanel";
import DetailPanel from "@/components/DetailPanel";
import ReadableCopy from "@/components/ReadableCopy";

export default function Page() {
  return (
    <>
      {/* 마크업이 먼저다. 캔버스는 이 내용을 보여 주는 한 가지 방법일 뿐이고,
          WebGL 이 없거나 스크린리더로 읽거나 크롤러가 훑을 때 남는 것은 이쪽이다. */}
      <ReadableCopy />
      <Carousel />
      <DetailPanel />
      <ClaimsPanel />
    </>
  );
}
