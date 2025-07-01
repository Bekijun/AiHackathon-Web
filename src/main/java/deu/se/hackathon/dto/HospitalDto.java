package deu.se.hackathon.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HospitalDto {
    private String name;
    private String address;
    private String phoneNumber;
}
