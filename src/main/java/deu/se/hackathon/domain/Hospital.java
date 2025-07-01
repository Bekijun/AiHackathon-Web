package deu.se.hackathon.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Hospital {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    private String address;

    private String phoneNumber;

    // 병원과 응급실 상태는 1:1 관계
    @OneToOne(mappedBy = "hospital", cascade = CascadeType.ALL)
    private EmergencyRoomStatus emergencyRoomStatus;
}
